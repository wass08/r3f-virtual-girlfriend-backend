import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { mkdir } from 'fs/promises';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "-");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "kgG7dCoKCfLehAPWkJOE";

const app = express();

// Middleware to handle JSON parsing
app.use(express.json());

// Custom CORS middleware with specific headers
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5174',
    'http://localhost:3000',
    'https://r3f-virtual-girlfriend-frontend-one.vercel.app',
    'https://r3f-virtual-girlfriend-backend-jg5a.onrender.com'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// CORS middleware configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5174',
      'http://localhost:3000',
      'https://r3f-virtual-girlfriend-frontend-one.vercel.app',
      'https://r3f-virtual-girlfriend-backend-jg5a.onrender.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true,
  maxAge: 86400 // CORS preflight cache for 24 hours
}));

const port = process.env.PORT || 3000;

// Create audios directory if it doesn't exist
try {
  await mkdir('audios', { recursive: true });
} catch (err) {
  if (err.code !== 'EEXIST') {
    console.error('Error creating audios directory:', err);
  }
}

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  try {
    const voices = await voice.getVoices(elevenLabsApiKey);
    res.send(voices);
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).send({ error: 'Failed to fetch voices' });
  }
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  try {
    await execCommand(
      `./bin/ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    );
    console.log(`Conversion done in ${new Date().getTime() - time}ms`);
    await execCommand(
      `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
    );
    console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
  } catch (error) {
    console.error('Error in lipSync:', error);
    throw error;
  }
};

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    
    if (!userMessage) {
      res.send({
        messages: [
          {
            text: "Hey dear... How was your day?",
            audio: await audioFileToBase64("audios/intro_0.wav"),
            lipsync: await readJsonTranscript("audios/intro_0.json"),
            facialExpression: "smile",
            animation: "Talking_1",
          },
          {
            text: "I missed you so much... Please don't go for so long!",
            audio: await audioFileToBase64("audios/intro_1.wav"),
            lipsync: await readJsonTranscript("audios/intro_1.json"),
            facialExpression: "sad",
            animation: "Crying",
          },
        ],
      });
      return;
    }

    if (!elevenLabsApiKey || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "-") {
      res.send({
        messages: [
          {
            text: "Please my dear, don't forget to add your API keys!",
            audio: await audioFileToBase64("audios/api_0.wav"),
            lipsync: await readJsonTranscript("audios/api_0.json"),
            facialExpression: "angry",
            animation: "Angry",
          },
          {
            text: "You don't want to ruin Wawa Sensei with a crazy Gemini and ElevenLabs bill, right?",
            audio: await audioFileToBase64("audios/api_1.wav"),
            lipsync: await readJsonTranscript("audios/api_1.json"),
            facialExpression: "smile",
            animation: "Laughing",
          },
        ],
      });
      return;
    }

    const prompt = `You are a virtual girlfriend.
    You will always reply with a JSON array of messages. With a maximum of 3 messages.
    Each message has a text, facialExpression, and animation property.
    The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
    The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
    Format your response as a valid JSON object with a 'messages' array.`;

    const result = await model.generateContent([prompt, userMessage]);
    const response = await result.response;
    let text = response.text();
    
    // Clean up the response text
    text = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    
    let messages;
    try {
      messages = JSON.parse(text);
      if (messages.messages) {
        messages = messages.messages;
      }
    } catch (error) {
      console.error('JSON parsing error:', error);
      messages = [{
        text: "I'm having trouble processing that right now. Could you try saying that again?",
        facialExpression: "sad",
        animation: "Talking_0"
      }];
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const fileName = `audios/message_${i}.mp3`;
      const textInput = message.text;
      
      try {
        await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
        await lipSyncMessage(i);
        message.audio = await audioFileToBase64(fileName);
        message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
      } catch (error) {
        console.error(`Error processing message ${i}:`, error);
        message.audio = await audioFileToBase64("audios/error.wav");
        message.lipsync = await readJsonTranscript("audios/error.json");
      }
    }

    res.send({ messages });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).send({
      messages: [{
        text: "Sorry, something went wrong. Please try again later.",
        facialExpression: "sad",
        animation: "Talking_0"
      }]
    });
  }
});

const readJsonTranscript = async (file) => {
  try {
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading transcript:', error);
    return {};
  }
};

const audioFileToBase64 = async (file) => {
  try {
    const data = await fs.readFile(file);
    return data.toString("base64");
  } catch (error) {
    console.error('Error converting audio to base64:', error);
    return "";
  }
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    messages: [{
      text: "An unexpected error occurred. Please try again later.",
      facialExpression: "sad",
      animation: "Talking_0"
    }]
  });
});

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
