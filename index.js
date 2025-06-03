const { graphqlHTTP } = require('express-graphql')
const { buildSchema } = require('graphql')
const { graphqlUploadExpress } = require('graphql-upload')
const userResolver = require('./resolvers/user.resolver')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const express = require('express')
const path = require('path')
require('dotenv').config()
const fs = require('fs')

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

const schemaPath = path.join(`${__dirname}/graphql`, 'user.graphql')
const schemaContent = fs.readFileSync(schemaPath, 'utf-8')

const schema = buildSchema(schemaContent)

const root = {
  ...userResolver,
}

const app = express()
const port = 3000

// Trong server.js, cập nhật phần sendMessage
socket.on('sendMessage', async ({ roomId, userId, message }) => {
  try {
    const newMessage = new Message({
      roomId,
      sender: userId,
      content: message,
      type: 'text',
    });
    await newMessage.save();
    // Populate sender để lấy thông tin username
    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username');
    io.to(roomId).emit('receiveMessage', populatedMessage);
  } catch (err) {
    console.error('Error saving message:', err);
  }
});
// Trong server.js, thêm API này trước phần khởi động server
app.get('/messages/:roomId', async (req, res) => {
  try {
    const messages = await Message.find({ roomId: req.params.roomId })
      .populate('sender', 'username') // Lấy username của người gửi
      .sort({ timestamp: 1 }); // Sắp xếp theo thời gian tăng dần
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Error fetching messages' });
  }
});

app.use(bodyParser.json())
app.use(
  '/graphql',
  graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
)
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
  }),
)

app.listen(3000, '0.0.0.0', () => {
  console.log('Server is running on http://0.0.0.0:3000/graphql');
});
