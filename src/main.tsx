import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const App = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
        Pukar Card Game
      </h1>
      <p className="text-slate-400">
        A strategic multi-deck card game for 4 or 6 players.
      </p>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
