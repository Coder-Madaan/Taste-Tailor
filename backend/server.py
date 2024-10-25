from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from langchain_core.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from diffusers import StableDiffusionPipeline
import torch
import os

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

# API Key and model setup
API_KEY =  "AIzaSyBsiMeYxPBVwerpCwZ_K45yT6yR12s-Q7Q"  # Replace with your key
llm = ChatGoogleGenerativeAI(api_key=API_KEY, model="gemini-1.5-flash", temperature=0.2)

# Initialize Stable Diffusion for image generation
device = "cuda" if torch.cuda.is_available() else "cpu"
pipe = StableDiffusionPipeline.from_pretrained("sd-legacy/stable-diffusion-v1-5", torch_dtype=torch.float16)
pipe = pipe.to(device)

# 1. Dish Suggestion Template
dish_suggestion_template = """
You are a friendly assistant. When the user expresses a craving or asks for something to eat, analyze the following input carefully:

User Input: {user_input}

If the user does not specify a cuisine, respond with only one dish name from Indian cuisine. 
If the user mentions a specific cuisine, then suggest only one dish name from that cuisine. 
Only provide the dish name without any additional commentary.
"""
dish_suggestion_prompt = PromptTemplate(template=dish_suggestion_template, input_variables=["user_input"])

# 2. Dish Name Extraction Template
dish_name_extraction_template = """
You are an expert in extracting dish names from user and AI conversations. 
Analyze the following response and extract the dish name.

Dish Suggestion Output: {dish_suggestion_output}

Your task is to extract the dish name from the provided output. 
Only return the dish name as a string, without any additional formatting.
"""
dish_name_extraction_prompt = PromptTemplate(template=dish_name_extraction_template, input_variables=["dish_suggestion_output"])

# 3. Recipe Generation Template
recipe_prompt_template = """
You are a professional chef. Your task is to provide a well-organized recipe for the given dish.

Dish Name: {dish_name}

### Recipe Structure:
Ingredients:
- List all ingredients with quantities.

Instructions:
1. Provide simple, step-by-step cooking instructions.
2. Add any tips or suggestions to enhance the dish.
"""
recipe_prompt = PromptTemplate(template=recipe_prompt_template, input_variables=["dish_name"])

# 4. Follow-up Response Template
followup_prompt_template = """
You are an expert assistant, always ready to answer follow-up questions related to the current recipe or dish.

You will receive the following inputs:
1. Dish Name: {dish_name}.
2. Recipe: The detailed recipe provided earlier in the interaction as {recipe}.
3. User Input: The follow-up question or query asked by the user, provided as {user_input}.

Use these inputs to:
- Suggest ingredient substitutions.
- Offer cooking tips, nutritional information, or serving suggestions.
- Adjust cooking times or storage recommendations based on user queries.

If the user's question is unrelated to the current dish or recipe, respond with:
"I’m here to help with recipe-related questions. Feel free to ask about cooking or the dish!"

Always refer to the specific dish name ({dish_name}) wherever appropriate to maintain context.
"""
followup_prompt = PromptTemplate(template=followup_prompt_template, input_variables=["dish_name", "user_input", "recipe"])

# 5. Routing Template
routing_template = """
Analyze the user's query: {user_input}

- If the query involves asking for a dish suggestion (e.g., craving, cuisine type, or explicit mention of a dish name), 
  return "dish_suggestion".
- If it asks for a recipe for a specific dish, return "recipe".
- If it’s a follow-up question related to a previously discussed dish or recipe, return "followup".

Respond with only one word: "dish_suggestion", "recipe", or "followup".
"""
routing_prompt = PromptTemplate(template=routing_template, input_variables=["user_input"])

# 6. Ingredient Extraction Template
ingredient_extraction_template = """
You are a professional chef specializing in identifying the most essential ingredients of a dish.

Analyze the recipe below and return up to 4 main ingredients that are crucial for the dish. 
Focus only on the core ingredients required to define the dish, ignoring minor seasonings or optional components.

### Recipe:
{recipe}

### Output:
Return the names of up to 4 main ingredients as a single line of comma-separated values.
"""
ingredient_extraction_prompt = PromptTemplate(template=ingredient_extraction_template, input_variables=["recipe"])

# ----------------- Memory -----------------
conversation_memory = ConversationBufferMemory(memory_key="chat_history", input_key="user_input", return_messages=True)

# ----------------- Chains -----------------
# 1. Dish Suggestion Chain
dish_suggestion_chain = LLMChain(prompt=dish_suggestion_prompt, llm=llm, output_key="dish_suggestion", memory=conversation_memory)

# 2. Dish Name Extraction Chain
dish_name_extraction_chain = LLMChain(prompt=dish_name_extraction_prompt, llm=llm, output_key="dish_name")

# 3. Recipe Generation Chain
recipe_chain = LLMChain(prompt=recipe_prompt, llm=llm, output_key="recipe")

# 4. Follow-up Chain
followup_chain = LLMChain(prompt=followup_prompt, llm=llm, output_key="followup_response")

# 5. Routing Chain
routing_chain = LLMChain(prompt=routing_prompt, llm=llm, output_key="route")

# 6. Ingredient Extraction Chain
ingredient_extraction_chain = LLMChain(prompt=ingredient_extraction_prompt, llm=llm, output_key="ingredients")

# ----------------- Flask Routes -----------------

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get('user_input', '')

    if not user_input:
        return jsonify({"error": "User input is required"}), 400

    try:
        # Route the query
        routing_response = routing_chain.run({"user_input": user_input})
        route = routing_response.strip()

        if route == "dish_suggestion":
            # Generate a dish suggestion
            dish_suggestion_response = dish_suggestion_chain.run({"user_input": user_input})
            dish_suggestion = dish_suggestion_response.strip()

            # Extract the dish name
            dish_name_response = dish_name_extraction_chain.run({"dish_suggestion_output": dish_suggestion})
            dish_name = dish_name_response.strip()

            return jsonify({"dish_suggestion": dish_name}), 200

        elif route == "recipe":
            # Generate the recipe
            dish_name = data.get('dish_name', '')
            if not dish_name:
                return jsonify({"error": "Dish name is required for recipe generation"}), 400

            recipe_response = recipe_chain.run({"dish_name": dish_name})
            recipe = recipe_response.strip()

            # Extract main ingredients from the recipe
            main_ingredients_response = ingredient_extraction_chain.run({"recipe": recipe})
            main_ingredients = main_ingredients_response.strip()

            return jsonify({"recipe": recipe, "main_ingredients": main_ingredients}), 200

        elif route == "followup":
            # Handle follow-up question
            dish_name = data.get('dish_name', '')
            recipe = data.get('recipe', '')
            if not dish_name or not recipe:
                return jsonify({"error": "Dish name and recipe are required for follow-up"}), 400

            followup_response = followup_chain.run({"dish_name": dish_name, "user_input": user_input, "recipe": recipe})
            followup_text = followup_response.strip()

            return jsonify({"followup_response": followup_text}), 200

        else:
            return jsonify({"error": "Unknown or unsupported route"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# Route: Generate images for ingredients and dish
@app.route('/generate_images', methods=['POST'])
def generate_images():
    data = request.json
    dish_name = data.get("dish_name", "Dish")
    main_ingredients = data.get("main_ingredients", [])

    # Generate image for dish
    dish_image_path = f"./images/{dish_name}_image.png"
    try:
        dish_prompt = f"Create an image of {dish_name} with traditional presentation."
        dish_image = pipe(dish_prompt).images[0]
        dish_image.save(dish_image_path)
    except Exception as e:
        return jsonify({"dish_image": "Dish image generation failed."}), 500

    return jsonify({"dish_image": dish_image_path})

# Route: Serve generated images
@app.route('/get_image/<filename>', methods=['GET'])
def get_image(filename):
    return send_from_directory('./images', filename)

# Start the Flask app
if __name__ == '__main__':
    if not os.path.exists('./images'):
        os.makedirs('./images')
    app.run(host='0.0.0.0', port=5000, debug=True)
