import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-",
});

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
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
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  await execCommand(
    `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
  );
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const n8nResponse = req.body.n8nResponse;

  // Parse the n8n response if it's a string
  const n8nOutput = n8nResponse ? JSON.parse(n8nResponse) : {};

  // Replace the message text with the output from n8n

  console.log("n8n: ", n8nOutput.output);
  
  let messages = [
    {
      text: n8nOutput.output || 'Meu nome é Ana. Sou uma trader profissional e estou aqui para ajudar com suas questões relacionadas a negociações e investimentos.',
      facialExpression: 'smile',
      animation: 'Talking_1'
    }
  ];

  console.log("messages: ", messages);

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const fileName = `audios/message_${i}.mp3`;
    const textInput = message.text; // Mentor: passar a frase 

    console.log("textInput: ", textInput);

    // Aqui utilizamos a nova API para gerar o áudio
    const mp3 = await openai.audio.speech.create({
      model: "tts-1", // ou tts-1-hd dependendo da qualidade desejada
      voice: "alloy", // Escolha uma voz da lista suportada
      input: textInput,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.writeFile(fileName, buffer);

    await lipSyncMessage(i);
    message.audio = await audioFileToBase64(fileName);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Trader mentor ${port}`);
});