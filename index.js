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
  const fileUrl = `http://localhost:3000/uploads/${req.file.filename}`;
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
