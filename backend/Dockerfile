FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Hugging Face Spaces requires port 7860
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

CMD ["npm", "start"]
