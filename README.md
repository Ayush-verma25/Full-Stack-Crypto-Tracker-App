# 🚀 Full-Stack Crypto Tracker App

A simple and functional full-stack web application that displays the top 10 cryptocurrencies with real-time price updates every 3 minutes.

This project is built using **React (Vite)** for the frontend, **Node.js + Express** for the backend, and **MongoDB** as the database. It uses **TailwindCSS** for styling and **Recharts** for data visualization. The backend is deployed on **Render**, and the frontend is deployed using **Vercel**.

---

## 🛠 Tech Stack

### Frontend
- [React](https://reactjs.org/) (with [Vite](https://vitejs.dev/))
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) — For chart visualizations
- [Lucide React](https://lucide.dev/) — Icon library
- [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

### Backend
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Axios](https://axios-http.com/) — For API requests

### Package Manager
- [npm](https://www.npmjs.com/)

### Deployment
- 🔁 **Backend** — [Render](https://full-stack-crypto-tracker-app-server.onrender.com/)
- 🌐 **Frontend** — [Vercel](https://full-stack-crypto-tracker-app.vercel.app/)

---

## 🔧 Features

- 🔄 Fetches and displays **top 10 cryptocurrencies**
- 🔁 Data auto-refreshes **every 3 minutes**
- 📊 Interactive charts and visualizations
- 📱 Responsive UI with Tailwind CSS
- 🌐 Full-stack architecture with REST API
- 📁 Clean and modular folder structure

---

## 📸 Screenshots

_Add screenshots of your app here if available (drag and drop or paste image links)_

---

## 📁 Project Structure

Full-Stack-Crypto-Tracker-App/
├── client/ # Frontend (React + Vite)
│ └── src/
│ ├── components/
│ ├── pages/
│ ├── assets/
│ └── ...
├── server/ # Backend (Node.js + Express)
│ ├── controllers/
│ ├── models/
│ ├── routes/
│ └── ...

2. Setup Backend
bash
Copy
Edit
cd server
npm install
# Add your MongoDB URI and other secrets to a `.env` file
npm run dev

3. Setup Frontend
bash
Copy
Edit
cd ../client
npm install
npm run dev

🌍 Live Demo
🔗 Frontend (Vercel): https://full-stack-crypto-tracker-app.vercel.app/

🔗 Backend (Render): https://full-stack-crypto-tracker-app-server.onrender.com/

⚙️ Environment Variables
In the backend, create a .env file with the following:

env
Copy
Edit
PORT=8000
MONGO_URI=your_mongodb_connection_string
COINGECKO_API_URL=https://api.coingecko.com/api/v3
🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

📄 License
MIT

🧑‍💻 Author
Ayush Verma — MERN Stack Developer
📧 Contact: [ayve012@gmail.com]
🔗 Portfolio: [your-portfolio-link.com]

## 🧑‍💻 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/Full-Stack-Crypto-Tracker-App.git
cd Full-Stack-Crypto-Tracker-App
