'use strict';

// Import the Dialogflow module from the Actions on Google client library.
const {
    dialogflow,
    Suggestions,
    List
} = require('actions-on-google');

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

//INIZIO CONFIGURAZIONE DATABASE
var admin = require('firebase-admin');
// Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: 'PROJECTID',
        clientEmail: 'CLIENTEMAIL',
        privateKey: 'PRIVATEKEY'
    }),
    databaseURL: 'https://databaseurl.firebaseio.com'
});

//FINE CONFIGURAZIONE DATABASE


// Instantiate the Dialogflow client.
const app = dialogflow({
    debug: true
});

//Funzione generale
String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

// Get a database reference 
var db = admin.database();
var ref_rifiuti = db.ref("/Rifiuti");


//Gestione ricerca rifiuto
function handleRichiestaRifiuto(conv, tipo_rifiuto) {

    //Query per tipo di rifiuto IDENTICO
    return ref_rifiuti.orderByChild("Nome").equalTo(tipo_rifiuto.toLowerCase()).once('value').then(function (item) {
        var reads = [];

        //Per ogni tipo di rifiuto identico trovato (dovrebbe essere 1)
        item.forEach(function (data) {
            //Query per la sua categoria
            var promise = db.ref('/Categorie/' + data.val().Categoria).once('value').then(function (item_cat) {
                //Stampiamo messaggio all'utente
                conv.add('Il rifiuto "' + data.val().Nome + '" fa parte della categoria: "' + item_cat.val().Nome.toLowerCase().capitalize() + '".');
                conv.add("Spero di essere stata d'aiuto. Puoi chiedermi un altro rifiuto se vuoi.");

            });
            reads.push(promise);

        });

        //Non e' stato trovato il tipo di rifiuto. Se il dispositivo ha uno schermo ne cerchiamo altri.
        if (item.val() === null) {

            if (conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')) {

                //Prendiamo la prima parola e ci tagliamo alcuni caratteri per fare la query di ricerca per risultati simili. In questo modo otteniamo piu risultati e risolviamo prob del sing/plur
                var tipo_rifiuto_input = tipo_rifiuto.split(' ')[0];

                if (tipo_rifiuto_input.length >= 4)
                    tipo_rifiuto_input = tipo_rifiuto_input.slice(0, tipo_rifiuto_input.length - 2);

                //Cerchiamo item che iniziano con l'input dell'utente modificato
                var promise2 = ref_rifiuti.orderByChild("Nome").startAt(tipo_rifiuto_input.toLowerCase()).endAt(tipo_rifiuto_input.toLowerCase() + "\uf8ff").once('value').then(function (similar_item) {

                    var ritems = {};
                    if (similar_item.numChildren() >= 2) {
                        conv.add("Non ho trovato quello che cercavi, ma ecco qui alcuni suggerimenti. Puoi selezionare un rifiuto simile o riprovare con un altro.");
                        var i = 0;
                        similar_item.forEach(function (data) {
                            if (i < 30) {
                                ritems[data.val().Nome] = {
                                    synonyms: [],
                                    title: data.val().Nome
                                };
                            }
                            i++;
                        });

                        conv.add(new List({
                            title: "Suggerimenti:",
                            items: ritems
                        }));
                    }
                    else {
                        conv.add("Non ho trovato nessun risultato, mi dispiace. Puoi riprovare con un altro rifiuto.");
                    }
                });
                reads.push(promise2);
            }
            else {
                conv.add("Non ho trovato nessun risultato, mi dispiace. Puoi riprovare con un altro rifiuto.");
            }
        }
        return Promise.all(reads);
    });

}

// Handle the Dialogflow intent named 'tipo di rifiuto'.
// The intent collects a parameter named 'tipo_rifiuto'.
app.intent('tipo di rifiuto', (conv, {
    tipo_rifiuto
}) => {
    return handleRichiestaRifiuto(conv, tipo_rifiuto);
});

app.intent('tipo di rifiuto confirmation', (conv, params, option) => {
    // Get the user's selection
    // Compare the user's selections to each of the item's keys
    if (!option) {
        conv.ask('Non hai selezionato nessun item.');
    }
    return handleRichiestaRifiuto(conv, option);

});


app.intent('test implicito', (conv, {
    tipo_rifiuto
}) => {
    return handleRichiestaRifiuto(conv, tipo_rifiuto);
});

// Set the DialogflowApp object to handle the HTTPS POST request.
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);