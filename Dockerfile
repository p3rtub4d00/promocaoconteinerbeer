# Usa uma imagem oficial e leve do Node.js
FROM node:18-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependência primeiro (otimiza o cache do Docker)
COPY package*.json ./

# Instala as dependências (Express, SQLite, Cors)
RUN npm install --production

# Copia o restante dos arquivos do projeto
COPY . .

# Expõe a porta que o Express vai usar
EXPOSE 3000

# Comando para iniciar o servidor
CMD [ "node", "backend/server.js" ]
