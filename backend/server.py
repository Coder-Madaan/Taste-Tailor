from flask import Flask, request, jsonify, send_file
import requests
from PIL import Image
from io import BytesIO
import os
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize the Flask app
app = Flask(__name__)
CORS(app)

# API Configuration
GOOGLE_API_KEY = os.getenv('AIzaSyBsiMeYxPBVwerpCwZ_K45yT6yR12s-Q7Q')
HF_API_TOKEN = os.getenv('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')
HF_API_URL = "https://api-inference.huggingface.co/models/sd-legacy/stable-diffusion-v1-5"

# Configure Gemini
genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-pro')

def generate_image(prompt):
    """Generate image using Stable Diffusion"""
    headers = {
        "Authorization": f"Bearer {HF_API_TOKEN}"
    }
    
    payload = {
        "inputs": prompt,
        "options": {"use_gpu": True}
    }
    
    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        
        image = Image.open(BytesIO(response.content))
        return image
    except Exception as e:
        print(f"Error generating image: {e}")
        return None

def get_recipe_from_gemini(prompt):
    """Get recipe information from Gemini API"""
    try:
        response = model.generate_content(f"""
        Act as a cooking expert and provide a detailed recipe based on: {prompt}
        Include:
        - Recipe name
        - List of ingredients with quantities
        - Step-by-step instructions
        - Cooking time and difficulty level
        - Tips for best results
        Format the response in a clear, friendly way.
        """)
        return response.text
    except Exception as e:
        print(f"Error getting recipe: {e}")
        return None

def extract_ingredients(recipe_text):
    """Extract main ingredients from recipe text"""
    try:
        response = model.generate_content(f"""
        Extract only the main ingredients from this recipe, return as a simple list:
        {recipe_text}
        """)
        return [ing.strip() for ing in response.text.split('\n') if ing.strip()]
    except Exception as e:
        print(f"Error extracting ingredients: {e}")
        return []

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_input = data.get('message', '')
        
        # Check for recipe-related queries
        if any(word in user_input.lower() for word in ['recipe', 'cook', 'make', 'prepare']):
            recipe_response = get_recipe_from_gemini(user_input)
            if recipe_response:
                return jsonify({
                    "response": recipe_response,
                    "success": True,
                    "main_ingredients": extract_ingredients(recipe_response)
                })
        
        # For general queries, get response from Gemini
        response = model.generate_content(
            f"As a cooking assistant, respond to: {user_input}"
        )
        
        return jsonify({
            "response": response.text,
            "success": True
        })

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return jsonify({
            "response": "I apologize, but I encountered an error. Please try again.",
            "success": False
        }), 500

@app.route('/generate_images', methods=['POST'])
def generate_images():
    try:
        data = request.json
        main_ingredients = data.get('main_ingredients', [])
        dish_name = data.get('dish_name', '')

        # Create images directory if it doesn't exist
        image_dir = 'generated_images'
        os.makedirs(image_dir, exist_ok=True)

        # Generate images for ingredients
        ingredient_images = []
        for ingredient in main_ingredients:
            prompt = f"High-quality photo of fresh {ingredient} on a clean kitchen counter, food photography style"
            ingredient_image = generate_image(prompt)
            
            if ingredient_image:
                image_path = os.path.join(image_dir, f"{ingredient.replace(' ', '_')}_image.png")
                ingredient_image.save(image_path)
                ingredient_images.append(os.path.basename(image_path))

        # Generate dish image
        dish_image_path = None
        if dish_name:
            prompt = f"Professional food photography of {dish_name}, beautifully plated, restaurant style presentation"
            dish_image = generate_image(prompt)
            
            if dish_image:
                dish_image_path = os.path.join(image_dir, f"{dish_name.replace(' ', '_')}_final.png")
                dish_image.save(dish_image_path)
                dish_image_path = os.path.basename(dish_image_path)

        return jsonify({
            "ingredient_images": ingredient_images,
            "dish_image": dish_image_path,
            "success": True
        })

    except Exception as e:
        print(f"Error generating images: {e}")
        return jsonify({
            "error": "Failed to generate images",
            "success": False
        }), 500

@app.route('/get_image/<filename>', methods=['GET'])
def get_image(filename):
    try:
        image_path = os.path.join('generated_images', filename)
        return send_file(image_path, mimetype='image/png')
    except Exception as e:
        print(f"Error serving image: {e}")
        return jsonify({"error": "Image not found"}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)