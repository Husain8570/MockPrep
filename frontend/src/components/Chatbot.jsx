import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.scss'; 
import { marked } from 'marked';
const API_URL = import.meta.env.VITE_API_URL;
import { Tooltip } from 'react-tooltip';

const Chatbot = () => {
  const [Loading , setLoading] = useState(false);
  const quizStatus = JSON.parse(localStorage.getItem('quizDetails') || null)?.status;
  if(quizStatus === 'Ongoing'){
    return null;
  }
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi there 👋\nHow can I help you today?" },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const chatBoxRef = useRef(null);

  // Auto-scroll chatbox when a new message is added
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setIsOpen(false);
    document.body.classList.remove('show-chatbot');
  }, []);
  // Toggle chatbot visibility
  const toggleChatbot = () => {
    setIsOpen(!isOpen);

    if (!isOpen) {
      document.body.classList.add('show-chatbot');
    } else {
      document.body.classList.remove('show-chatbot');
    }

    console.log('Chatbot toggled');
  };

  // Send user message and handle backend response
  const handleSendMessage = async (e) => {
    e.preventDefault();
    // Trim the inputMessage to remove extra spaces/newlines
    setLoading(true);

    const trimmedMessage = inputMessage.trim();
  
    // Prevent sending empty or just newline messages
    if (trimmedMessage === '') return;
  
    const userMessage = { sender: "user", text: trimmedMessage };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
  
    setInputMessage('');
  
    console.log(JSON.stringify({ message: trimmedMessage }));
    try {
      const response = await fetch(`${API_URL}/api/v1/questions/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });
      const data = await response.json();
      
      // error handling
      const botReply = data.reply || "Sorry, I couldn't understand that.";
      const formattedReply = formatBotReply(botReply);
  
      const botMessage = { sender: "bot", text: formattedReply }; // using formatted reply
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chatbot response:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "bot", text: "Sorry, something went wrong. Please try again." }
      ]);
      setLoading(false);
    }
  };
  // Function to format the bot's reply (replaces ** with <strong> and ` with <code>)
const formatBotReply = (reply) => {
  // Replace **bold** with <strong>bold</strong>
  let formattedText = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Replace `code` with <code>code</code>
  formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');

  return formattedText;
};
  return (
    <div className='chatbot-container '>
      <button id='toggle-bot' className="chatbot-toggler" onClick={toggleChatbot}>
        <span className="material-symbols-rounded">mode_comment</span>
        <span className="material-symbols-outlined">close</span>
      </button>
      <Tooltip anchorSelect='#toggle-bot' place='top' content='Chat with our AI Chatbot' />

      {isOpen && (
        <div className="chatbot">
          <header>
            <span id='go-full' className="material-symbols-rounded go-full">open_in_full</span>
            <h2>Chatbot</h2>
            <span id='close-bot' className="close-btn material-symbols-outlined" onClick={toggleChatbot}>close</span>
              
          </header>
          <Tooltip anchorSelect='#go-full' place='top' content='Open chatbot in full screen' />
          <Tooltip anchorSelect='#close-bot' place='top' content='Close chatbot' />

          <ul className="chatbox" ref={chatBoxRef}>
            {messages.map((msg, index) => (
              <li key={index} className={`chat ${msg.sender === 'user' ? 'outgoing' : 'incoming'}`}>
                {msg.sender === 'bot' && <span className="material-symbols-outlined">smart_toy</span>}
              {/* Render bot message using dangerouslySetInnerHTML */}
              {msg.sender === 'bot' ? (
                <p
                  dangerouslySetInnerHTML={{ __html: msg.text }}
                />
              ) : (
                <p>{msg.text}</p> // Render user messages as plain text
              )}
            </li>
            ))}
            {Loading &&
              <li className={`chat incoming`}>
                <span className="material-symbols-outlined">smart_toy</span>
                <p><h1 className="loader-chatbot"></h1></p>
              </li>
            }

          </ul>

          <div className="chat-input">
            <textarea
              placeholder="Enter a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
              required
            />
            <span id="send-btn" className="material-symbols-rounded" onClick={handleSendMessage}>send</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
