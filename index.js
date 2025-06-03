const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const { graphqlUploadExpress } = require('graphql-upload');
const userResolver = require('./resolvers/user.resolver');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

// Import models
const Message = require('./models/message.model');
const Friend = require('./models/friend.model');
const User = require('./models/user.model');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// GraphQL schema
const schemaPath = path.join(`${__dirname}/graphql`, 'user.graphql');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
const schema = buildSchema(schemaContent);

const root = {
  ...userResolver,
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Socket.IO logic for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(roomId);
    console.log(`${userId} joined room ${roomId}`);
  });

  socket.on('sendMessage', async ({ roomId, userId, message, type = 'text' }) => {
    try {
      const newMessage = new Message({
        roomId,
        sender: userId,
        content: message,
        type,
      });
      await newMessage.save();
      const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username avatar');
      io.to(roomId).emit('receiveMessage', populatedMessage);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// API to upload files
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `https://discord-clone-etat.onrender.com/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// API to fetch old messages
app.get('/messages/:roomId', async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .populate('sender', 'username avatar')
      .sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

// API to search users
app.get('/search/users', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { displayName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    }).select('_id username displayName profilePic');
    res.json(users);
  } catch (err) {
    console.error('Error searching users:', err);
    res.status(500).json({ error: 'Error searching users' });
  }
});

// API to add friend
app.post('/friends/add', bodyParser.json(), async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' });
    }
    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }

    const existingFriend = await Friend.findOne({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });
    if (existingFriend) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    const newFriend = new Friend({
      userId,
      friendId,
      status: 'pending',
    });
    await newFriend.save();
    res.status(200).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error('Error adding friend:', err);
    res.status(500).json({ error: 'Error adding friend' });
  }
});

// API to list friends
app.get('/friends/list', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const friends = await Friend.find({
      $or: [{ userId, status: 'accepted' }, { friendId: userId, status: 'accepted' }],
    }).populate('friendId', 'username displayName profilePic');
    const friendList = friends.map(friend => ({
      friendId: friend.friendId._id,
      username: friend.friendId.username,
      displayName: friend.friendId.displayName,
      profilePic: friend.friendId.profilePic,
    }));
    res.json(friendList);
  } catch (err) {
    console.error('Error fetching friends:', err);
    res.status(500).json({ error: 'Error fetching friends' });
  }
});

// Express middleware
app.use(bodyParser.json());
app.use(
  '/graphql',
  graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
);
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
  }),
);

// Start the server
const port = 3000;
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${port}/graphql`);
});
