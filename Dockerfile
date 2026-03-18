FROM node:18-alpine

# Define o diretório de trabalho no container
WORKDIR /app

# Copia os arquivos essenciais do frontend
COPY index.html app.js styles.css ./

# Move para a pasta do servidor para inicializar dependências
WORKDIR /app/server

# Copia os arquivos de configuração do npm primeiro (melhor para cache do Docker)
COPY server/package.json server/package-lock.json* ./

# Instala as dependências de produção
RUN npm install --production

# Copia o restante dos arquivos do servidor
COPY server/ ./

# Volta para a raiz para o backend encontrar o index.html via ".."
WORKDIR /app

# Expõe a porta usada no server.js
EXPOSE 3000

# Inicia o servidor Node.js
CMD ["node", "server/server.js"]
