// Richiamo il modulo fs per la gestione dei file, express per il framework web e path per la gestione dei percorsi
var fs = require('fs');
const express = require('express');
const path = require('path');

// Creo un'applicazione Express e un server HTTP basato su di essa
const server = express();
const http = require('http').Server(server);

// Configuro una rotta per la radice del server, che invia il file HTML
server.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'capolavoro.html'));
});

// Avvio del server HTTP sulla porta 3000
http.listen(3000, () => {
  console.log('Listening on 3000');
});

// Importo il modulo WebSocket (ws)
const { Server } = require('ws');

// Variabili per tenere traccia del numero di giocatori, client WebSocket e caselle
let quanti = 0;
let clients = [];
let punteggiRicevuti = {};
let risultatoConfronto = null; // Inizializza la variabile risultatoConfronto
let punteggiFinali = {};


for (let i = 1; i <= 8; i++) {
  punteggiFinali[i] = null; // Inizializza tutti i punteggi finali a null
  punteggiRicevuti[i] = false; // Inizializza tutti i punteggi ricevuti a false
}

// Creo un server WebSocket separato dal server HTTP
const ws_server = new Server({ noServer: true });

// Gestione dell'aggiornamento del protocollo HTTP a WebSocket
http.on('upgrade', (request, socket, head) => {
  ws_server.handleUpgrade(request, socket, head, (socket) => {
    ws_server.emit('connection', socket, request);
  });
});

// Evento di connessione WebSocket
ws_server.on('connection', (ws) => {
  quanti++;

  // Se ci sono già più di un giocatore, termina la connessione del nuovo arrivato
  if (clients.length > 7) {
    quanti--;
    ws.terminate();
  }

  // Assegna un ID univoco al WebSocket
  ws.id = quanti;
  clients.push(ws.id);

  // Stampa il nuovo giocatore e gli ID dei giocatori esistenti
  console.log("nuovo:" + ws.id);
  let s = "";
  for (let z = 0; z < clients.length; z++) s = s + clients[z] + " ";
  console.log("clients : " + s);

  // Invia informazioni sulla connessione a tutti i client WebSocket
  let position = {
    quanti: clients.length,
    tipo: 0
  }
  let data = JSON.stringify({ 'position': position });
  ws_server.clients.forEach((client) => {
    client.send(data);
  });

  // Invia un messaggio al client appena connesso con le informazioni sulla sua connessione
  position = {
    quanti: clients.length,
    chi: ws.id,
    tipo: -1
  }
  data = JSON.stringify({ 'position': position });
  ws.send(data);

  // Inizializza il punteggio ricevuto per questo client come falso
  punteggiRicevuti[ws.id] = false;

  // Gestisce l'evento di chiusura della connessione WebSocket
  ws.on('close', () => {
    // Rimuove il giocatore che si è disconnesso dalla lista dei giocatori
    for (let k = 0; k < clients.length; k++) {
      if (clients[k] === ws.id) {
        clients.splice(k, 1);
      }
    }

    // Rimuove il punteggio ricevuto per questo client
    delete punteggiRicevuti[ws.id];

    // Stampa l'ID del giocatore che si è disconnesso e gli ID dei giocatori rimanenti
    console.log("esce:" + ws.id);
    s = "";
    for (let z = 0; z < clients.length; z++) s = s + clients[z] + " ";
    console.log("clients : " + s);

    // Invia informazioni sulla disconnessione a tutti i client WebSocket rimanenti
    position = {
      quanti: clients.length,
      tipo: -2
    }
    const data = JSON.stringify({ 'position': position });
    ws_server.clients.forEach((client) => {
      client.send(data);
    });
  });

  ws.on('message', (message) => {
    // Codice per gestire i messaggi WebSocket
    const parsedData = JSON.parse(message);
    if (parsedData && parsedData.punteggioFinale !== undefined && !punteggiRicevuti[ws.id]) {
      // Esegui le operazioni necessarie con il punteggio finale
      console.log('Punteggio finale ricevuto dal client ' + ws.id + ':', parsedData.punteggioFinale);

      // Salva il punteggio finale per questo client
      punteggiFinali[ws.id] = parsedData.punteggioFinale;

      // Dopo aver salvato il punteggio finale per un client
      console.log('Punteggio finale salvato per il client ' + ws.id + ':', punteggiFinali[ws.id]);

      // Imposta il punteggio ricevuto per questo client su true per indicare che è stato ricevuto
      punteggiRicevuti[ws.id] = true;

      // Controlla se tutti i giocatori hanno inviato i loro punteggi finali
      let tuttiPunteggiRicevuti = true;
      for (let i = 1; i <= clients.length; i++) {
        if (!punteggiRicevuti[i]) {
          tuttiPunteggiRicevuti = false;
          break;
        }
      }

      if (tuttiPunteggiRicevuti) {
        // Confronta i punteggi e determina il vincitore
        let vincitore = null;
        let punteggioMassimo = -Infinity;
        for (let i = 1; i <= clients.length; i++) {
          if (punteggiFinali[i] > punteggioMassimo) {
            punteggioMassimo = punteggiFinali[i];
            vincitore = i;
          }
        }

        // Controlla se ci sono più vincitori con lo stesso punteggio massimo
        let vincitoriMultipli = [];
        for (let i = 1; i <= clients.length; i++) {
          if (punteggiFinali[i] === punteggioMassimo) {
            vincitoriMultipli.push(i);
          }
        }
        console.log("vince " + vincitore);
        // Invia il risultato del confronto a tutti i client
        const risultatoConfronto = JSON.stringify({ 'vincitore': vincitoriMultipli });
        ws_server.clients.forEach((client) => {
          client.send(risultatoConfronto);
        });
        // Dopo aver inviato il risultato del confronto a tutti i client
        console.log('Risultato del confronto inviato a tutti i client:', risultatoConfronto);


        // Resettare i punteggi ricevuti per prepararsi a una nuova partita
        for (let i = 1; i <= clients.length; i++) {
          punteggiRicevuti[i] = false;
          punteggiFinali[i] = null;
        }
      }
    }
  });
});
