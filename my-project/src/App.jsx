import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Send, Utensils, Loader, ImageIcon } from 'lucide-react';

const RecipeChatbot = () => {
  const [messages, setMessages] = useState([
    { role: 'bot', content: "Hello! I'm your personal recipe assistant. What would you like to cook today?" }
  ]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [generatedImages, setGeneratedImages] = useState(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  
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

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // First, send message to chat endpoint
      const chatResponse = await fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_input: input }),
      });

      if (!chatResponse.ok) {
        throw new Error('Chat API request failed');
      }

      const chatData = await chatResponse.json();
      console.log('Chat Response:', chatData);
      // Add bot's response to chat
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: chatData.response 
      }]);

      // If the message contains ingredients or recipe, try to generate images
      if (input.toLowerCase().includes('recipe') || input.toLowerCase().includes('ingredient')) {
        setIsGeneratingImages(true);
        
        // Extract potential ingredients and dish name from user input
        const words = input.split(' ');
        const potentialDish = words[words.indexOf('recipe') + 1] || '';
        
        const imageResponse = await fetch('http://127.0.0.1:5000/generate_images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            main_ingredients: [],  // You might want to parse ingredients from the input
            dish_name: potentialDish
          }),
        });

        if (!imageResponse.ok) {
          throw new Error('Image generation failed');
        }

        const imageData = await imageResponse.json();
        setGeneratedImages(imageData);
        
        // Add image results to chat
        if (imageData.dish_image && imageData.dish_image !== "Dish image generation failed.") {
          const filename = imageData.dish_image.split('/').pop();
          setMessages(prev => [...prev, {
            role: 'bot',
            content: (
              <div className="space-y-2">
                <p>I've generated an image of the dish:</p>
                <img 
                  src={`http://127.0.0.1:5000/get_image/${filename}`}
                  alt="Generated dish"
                  className="rounded-lg shadow-md w-full max-w-md mx-auto"
                />
              </div>
            )
          }]);
        }
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: "I'm sorry, I encountered an error while processing your request. Please try again."
      }]);
    } finally {
      setIsTyping(false);
      setIsGeneratingImages(false);
    }
  };

  const renderMessage = (message) => {
    if (typeof message.content === 'string') {
      return message.content;
    }
    return message.content;  // For JSX content (like images)
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-yellow-200 via-pink-200 to-blue-200 flex items-center justify-center p-4">
      <motion.div 
        className="w-full max-w-4xl h-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden relative"
        style={{ perspective: '1000px' }}
        initial={{ rotateY: -30, opacity: 0 }}
        animate={{ rotateY: isOpen ? 0 : -30, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="h-full flex transform-style-3d">
          <div className="w-1/3 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-l-3xl p-6 flex flex-col justify-between items-center transform rotate-y-5 origin-left">
            <motion.div
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <ChefHat className="w-20 h-20 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white text-center">Taste Tailor</h1>
            <motion.div
              initial={{ rotate: 180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <Utensils className="w-16 h-16 text-white" />
            </motion.div>
          </div>
          
          <div className="w-2/3 bg-white rounded-r-3xl flex flex-col relative overflow-hidden">
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
                    <div className={`inline-block p-3 rounded-2xl ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' 
                        : 'bg-gradient-to-r from-gray-100 to-gray-200'
                    }`}>
                      {renderMessage(message)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {(isTyping || isGeneratingImages) && (
                <motion.div 
                  className="flex items-center space-x-2 text-gray-500"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>{isGeneratingImages ? "Generating images..." : "Chef is typing..."}</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask for a recipe..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-grow p-3 border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <button 
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-full flex items-center justify-center hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
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