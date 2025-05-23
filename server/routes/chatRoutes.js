const express = require('express');
const axios = require('axios');
const Chat = require('../models/Chat');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const router = express.Router();

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.post('/', authenticate, async (req, res) => {
  const { message } = req.body;
  try {
    let chat = await Chat.findOne({ userId: req.user._id });
    if (!chat) {
      chat = new Chat({ userId: req.user._id, messages: [] });
    }

    chat.messages.push({ role: 'user', content: message });

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: chat.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    chat.messages.push({ role: 'assistant', content: reply });
    await chat.save();

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ message: 'ChatGPT API error' });
  }
});

module.exports = router;
