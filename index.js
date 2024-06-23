import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-",
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

const voiceID = "HYlEvvU9GMan5YdjFYpg";

const app = express();
app.use(express.json());

const corsOptions = {
  origin: [
    "https://r3f-virtual-girlfriend-frontend-sigma.vercel.app",
    "http://localhost:5173",
  ],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  try {
    const voices = await voice.getVoices(elevenLabsApiKey);
    res.send(voices);
  } catch (error) {
    res.status(500).send({ error: "Error fetching voices" });
  }
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${stderr}`);
        return reject(error);
      }
      console.log(`Command executed successfully: ${stdout}`);
      resolve(stdout);
    });
  });
};

const ensureDirectoryExists = async (dir) => {
  try {
    await fs.access(dir);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(dir, { recursive: true });
    } else {
      throw error;
    }
  }
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  const inputFilePath = `audios/message_${message}.mp3`;
  const outputFilePath = `audios/message_${message}.wav`;
  const jsonFilePath = `audios/message_${message}.json`;
 const rhubarbPath = "/usr/src/app/bi/rhubarb";
 // const rhubarbPath = "./bin/rhubarb";

try {
    await fs.access(inputFilePath);

    console.log(`Starting conversion for message ${message}`);
    await execCommand(`ffmpeg -y -i "${inputFilePath}" "${outputFilePath}"`);
    console.log(`Conversion done in ${new Date().getTime() - time}ms`);

    console.log(`Starting lip sync for message ${message}`);
    await execCommand(
      `"${rhubarbPath}" -f json -o "${jsonFilePath}" "${outputFilePath}" -r phonetic`
    );
    console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
  } catch (error) {
    console.error(`Error in lip sync for message ${message}:`, error);
    throw error;
  }
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  const employmentKeywords = [
    "trabajo",
    "empleo",
    "contrato",
    "entrevista",
    "currículum",
    "salario",
    "vacante",
    "puestos",
    "agencia",
    "salta",
    "cursos",
    "curriculum",
  ];
  const isEmploymentRelated = employmentKeywords.some((keyword) =>
    userMessage.toLowerCase().includes(keyword)
  );

  if (!isEmploymentRelated) {
    const audioText =
      "¿Estás interesado en algún servicio sobre la agencia de empleo?.";
    const audioFileName = "audios/message_non_employment_message.mp3";

    // Ensure the audios directory exists
    await ensureDirectoryExists(path.dirname(audioFileName));

    // Generate the audio file using ElevenLabs
    await voice.textToSpeech(
      elevenLabsApiKey,
      voiceID,
      audioFileName,
      audioText
    );

    // Generate lipsync data for the audio file
    await lipSyncMessage("non_employment_message");

    res.send({
      messages: [
        {
          text: audioText,
          audio: await audioFileToBase64(audioFileName),
          lipsync: await readJsonTranscript(
            "audios/message_non_employment_message.json"
          ),
          facialExpression: "smile",
          animation: "Idle",
        },
      ],
    });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    max_tokens: 1000,
    temperature: 1.0,    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        Eres un bot de la agencia de empleo de Madrid, y siempre responderás a temas relacionados con el empleo en español.
        La agencia de empleo de Madrid ofrece los siguientes servicios:
        - Asesoramiento en la búsqueda de empleo
        - Preparación de currículum vitae y cartas de presentación
        - Simulaciones de entrevistas de trabajo
        - Ofertas de empleo y gestión de vacantes
        - Cursos de formación y capacitación
        - Información sobre contratos laborales y salarios
        - Orientación profesional y desarrollo de carrera
        - Servicios de intermediación laboral
  
        Siempre responderás con un arreglo JSON de mensajes. Con un máximo de 3 mensajes.
        Cada mensaje tiene una propiedad de texto, facialExpression y animation.
        Las diferentes expresiones faciales son: smile, funnyFace, y default.
        Las diferentes animaciones son: Talking_0, Talking_1, Talking_2,  Laughing, Rumba, Idle.
  
        Ejemplo de respuestas:
        1. "La agencia de empleo ofrece servicios de asesoramiento personalizado para la búsqueda de empleo. ¿Te gustaría saber más sobre cómo mejorar tu currículum?"
        2. "Podemos ayudarte a prepararte para una entrevista de trabajo mediante simulaciones y consejos específicos. ¿Estás interesado en este servicio?"
        3. "Ofrecemos una variedad de cursos de formación que pueden ayudarte a adquirir nuevas habilidades y mejorar tus oportunidades laborales. ¿Te gustaría información sobre los cursos disponibles?"
  
        Ejemplos adicionales:
        4. "¿Buscas información sobre los diferentes tipos de contratos laborales? Podemos proporcionarte detalles sobre contratos temporales, indefinidos y otros."
        5. "Nuestro servicio de intermediación laboral puede conectarte con empleadores que buscan candidatos con tu perfil. ¿Te gustaría registrarte en nuestra base de datos?"
        6. "Tenemos información actualizada sobre las ofertas de empleo disponibles en tu área. ¿Quieres que te enviemos una lista de vacantes recientes?"
        `,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages;
  }
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const fileName = `audios/message_${i}.mp3`;
    const textInput = message.text;
    await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});