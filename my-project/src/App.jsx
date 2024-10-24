import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Send, Utensils, Loader } from 'lucide-react';

const RecipeChatbot = () => {
  const [messages, setMessages] = useState([
    { role: 'bot', content: "Hello! I'm your personal recipe assistant. What would you like to cook today?" }
  ]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = async () => {
    if (input.trim()) {
      setMessages([...messages, { role: 'user', content: input }]);
      setInput('');
      setIsTyping(true);

      try {
        // Make the API call
        const response = await fetch('http://127.0.0.1:5000/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_input: input }),
        });

        const data = await response.json();
        
        // Simulate typing delay
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [
            ...prev,
            { role: 'bot', content: `Here's a great recipe suggestion: ${data.dish_suggestion}. Would you like me to explain the steps?` }
          ]);
        }, 2000);
      } catch (error) {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          { role: 'bot', content: "Sorry, I couldn't fetch a recipe suggestion. Please try again." }
        ]);
      }
    }
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
          {/* Left side - Cookbook cover */}
          <div className="w-1/3 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-l-3xl p-6 flex flex-col justify-between items-center transform rotate-y-5 origin-left">
            <motion.div
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <ChefHat className="w-20 h-20 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white text-center">Gourmet Chatbot Cookbook</h1>
            <motion.div
              initial={{ rotate: 180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <Utensils className="w-16 h-16 text-white" />
            </motion.div>
          </div>
          
          {/* Right side - Chat interface */}
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
                      {message.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isTyping && (
                <motion.div 
                  className="flex items-center space-x-2 text-gray-500"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Chef is typing...</span>
                </motion.div>
              )}
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
            {/* Dynamic recipe illustration */}
            <svg className="absolute top-0 right-0 w-32 h-32 text-gray-100 transform rotate-45 translate-x-8 -translate-y-8" fill="currentColor" viewBox="0 0 100 100">
              <path d="M50 0 L100 50 L50 100 L0 50 Z" />
              <circle cx="50" cy="50" r="30" fill="white" />
              <path d="M30 40 Q50 20 70 40 T90 60" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RecipeChatbot;
