# Dockerfile

# Utiliza la última imagen de Node como base
FROM node:latest

# Instala ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Instala Node.js y npm
RUN apt-get install -y nodejs npm

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos del proyecto al contenedor
COPY . .

# Instala las dependencias
RUN npm install

# Expone el puerto en el que tu aplicación se ejecutará
EXPOSE 3000

# Comando para ejecutar tu aplicación cuando se inicie el contenedor
CMD ["node", "index.js"]
