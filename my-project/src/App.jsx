import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Send, Utensils, Loader, Image as ImageIcon } from 'lucide-react';

const RecipeChatbot = () => {
  const [messages, setMessages] = useState([
    { role: 'bot', content: "Hello! I'm your personal recipe assistant. What would you like to cook today?" }
  ]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const formatRecipeText = (text) => {
    // Format recipe text with proper styling
    const sections = text.split('\n');
    return sections.map((section, index) => {
      if (section.trim().startsWith('-')) {
        return (
          <li key={index} className="ml-4">
            {section.replace('-', '').trim()}
          </li>
        );
      }
      if (section.includes(':')) {
        const [title, content] = section.split(':');
        return (
          <div key={index} className="mb-2">
            <span className="font-bold">{title}:</span>
            <span>{content}</span>
          </div>
        );
      }
      if (section.trim().length === 0) {
        return <br key={index} />;
      }
      return <p key={index} className="mb-2">{section}</p>;
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Get recipe/chat response
      const chatResponse = await fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!chatResponse.ok) throw new Error('Chat API request failed');
      const chatData = await chatResponse.json();

      if (chatData.success) {
        // Add the recipe text response
        setMessages(prev => [...prev, {
          role: 'bot',
          content: formatRecipeText(chatData.response)
        }]);

        // If we have a recipe response with ingredients, generate images
        if (chatData.main_ingredients && input.toLowerCase().includes('recipe')) {
          setIsGeneratingImage(true);
          
          const imageResponse = await fetch('http://127.0.0.1:5000/generate_images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              main_ingredients: chatData.main_ingredients,
              dish_name: input.replace(/recipe|make|cook/gi, '').trim()
            }),
          });

          if (!imageResponse.ok) throw new Error('Image generation failed');
          const imageData = await imageResponse.json();

          if (imageData.success) {
            // Add ingredient images
            if (imageData.ingredient_images?.length > 0) {
              setMessages(prev => [...prev, {
                role: 'bot',
                content: (
                  <div className="space-y-4">
                    <p className="font-semibold">Main Ingredients:</p>
                    <div className="grid grid-cols-2 gap-4">
                      {imageData.ingredient_images.map((img, index) => (
                        <div key={index} className="relative">
                          <img
                            src={`http://127.0.0.1:5000/get_image/${img}`}
                            alt={`Ingredient ${index + 1}`}
                            className="rounded-lg shadow-md w-full h-48 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }]);
            }

            // Add final dish image
            if (imageData.dish_image) {
              setMessages(prev => [...prev, {
                role: 'bot',
                content: (
                  <div className="space-y-2">
                    <p className="font-semibold">Final Dish:</p>
                    <img
                      src={`http://127.0.0.1:5000/get_image/${imageData.dish_image}`}
                      alt="Final dish"
                      className="rounded-lg shadow-md w-full max-w-md mx-auto"
                    />
                  </div>
                )
              }]);
            }
          }
        }
      } else {
        throw new Error('Recipe generation failed');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: "I'm sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsTyping(false);
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-yellow-200 via-pink-200 to-blue-200 flex items-center justify-center p-4">
      <motion.div 
        className="w-full max-w-4xl h-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden relative"
        initial={{ rotateY: -30, opacity: 0 }}
        animate={{ rotateY: isOpen ? 0 : -30, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="h-full flex">
          {/* Left sidebar */}
          <div className="w-1/3 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-l-3xl p-6 flex flex-col justify-between items-center">
            <motion.div
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <ChefHat className="w-20 h-20 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white text-center">Recipe Assistant</h1>
            <motion.div
              initial={{ rotate: 180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <Utensils className="w-16 h-16 text-white" />
            </motion.div>
          </div>
          
          {/* Chat area */}
          <div className="w-2/3 bg-white rounded-r-3xl flex flex-col relative">
            <div className="flex-grow p-6 overflow-auto" style={{ maxHeight: 'calc(100% - 80px)' }}>
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div 
                    key={index} 
                    className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className={`inline-block p-3 rounded-2xl max-w-[80%] ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' 
                        : 'bg-gray-100'
                    }`}>
                      {message.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {(isTyping || isGeneratingImage) && (
                <motion.div 
                  className="flex items-center space-x-2 text-gray-500"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>
                    {isGeneratingImage ? "Generating images..." : "Chef is typing..."}
                  </span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about a recipe..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-grow p-3 border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <button 
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-full flex items-center justify-center hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
                  disabled={isTyping || isGeneratingImage}
                >
                  <Send className="w-5 h-5 mr-2" />
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RecipeChatbot;