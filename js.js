// Função para normalizar o texto removendo acentos e caracteres especiais
function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Função para dividir uma string em tokens
function tokenize(text) {
    return normalizeText(text).split(' ').filter(token => token.trim() !== '');
}

// Função para calcular a similaridade de strings usando string-similarity
function calculateSimilarity(str1, str2) {
    const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return stringSimilarity.compareTwoStrings(normalize(str1), normalize(str2));
}

let awaitingUserResponse = false;
let currentQuestion = '';

// Carregar respostas salvas do localStorage
let savedResponses = JSON.parse(localStorage.getItem('savedResponses')) || {};

async function processInput() {
    const userInput = document.getElementById('user-input').value;

    if (userInput.trim() === '') {
        return;
    }

    displayMessage(userInput, 'user');
    document.getElementById('user-input').value = '';

    // Mostrar o indicador de carregamento
    showLoading();

    // Esperar 3 segundos antes de mostrar a resposta
    setTimeout(async () => {
        if (awaitingUserResponse) {
            saveNewResponse(currentQuestion, userInput);
            awaitingUserResponse = false;
            currentQuestion = '';
            hideLoading();
            displayMessage(`Obrigado! Sua resposta foi salva.`, 'ai');
            return;
        }

        if (userInput.toLowerCase().startsWith('pesquise sobre')) {
            const query = userInput.substring(14).trim();
            await searchAndDisplayResults(query);
            hideLoading();
            return;
        }

        if (savedResponses[userInput]) {
            hideLoading();
            displayMessage(savedResponses[userInput], 'ai');
            return;
        }

        const predefinedResponses = await fetch('respostas.json')
            .then(response => response.json())
            .catch(error => {
                hideLoading();
                displayMessage(`Erro ao carregar respostas prontas: ${error.message}`, 'ai');
                return {};
            });

        let bestMatch = '';
        let highestSimilarity = 0;

        for (const [question, answer] of Object.entries(predefinedResponses)) {
            const similarity = calculateSimilarity(userInput, question);

            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = answer;
            }
        }

        const similarityThreshold = 0.5;

        if (highestSimilarity >= similarityThreshold) {
            hideLoading();
            displayMessage(bestMatch, 'ai');
        } else {
            currentQuestion = userInput;
            awaitingUserResponse = true;
            hideLoading();
            displayMessage(`Eu não tenho uma resposta para isso agora. Você sabe a resposta para a pergunta: "${userInput}"?`, 'ai');
        }
    }, 3000);
}

async function searchAndDisplayResults(query) {
    try {
        const searchResults = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&t=h_&ia=web`, {
            method: 'GET'
        });

        if (!searchResults.ok) {
            throw new Error('Erro na solicitação de busca');
        }

        const data = await searchResults.json();
        const topResults = data.RelatedTopics.slice(0, 3);

        let responses = '';

        topResults.forEach((result, index) => {
            if (result.FirstURL && result.Text) { 
                responses += `
                    <div>
                        <strong>Opção ${index + 1}:</strong> <a href="${result.FirstURL}" target="_blank">${result.Text}</a>
                    </div>
                `;
            }
        });

        if (responses === '') {
            responses = 'Desculpe, não conseguimos encontrar resultados relevantes desta vez. Vamos tentar de novo?';
        }

        displayMessage(responses, 'ai');
    } catch (error) {
        displayMessage(`Desculpe, houve um erro ao realizar a busca: ${error.message}`, 'ai');
    }
}

function displayMessage(message, sender) {
    const chatContainer = document.getElementById('chat-container');
    const messageBubble = document.createElement('div');
    messageBubble.className = sender === 'user' ? 'user-message' : 'ai-message';
    messageBubble.innerHTML = message;  // Use innerHTML to render HTML content
    chatContainer.appendChild(messageBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function saveNewResponse(question, answer) {
    savedResponses[question] = answer; // Salvar a resposta no objeto
    localStorage.setItem('savedResponses', JSON.stringify(savedResponses)); // Salvar no localStorage
    console.log('Nova resposta salva:', question, answer);
}

// Função para exibir a mensagem de carregamento
function showLoading() {
    const chatContainer = document.getElementById('chat-container');
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'loader ai-message';
    loadingMessage.id = 'loading-indicator';
    loadingMessage.innerHTML = '<span></span><span></span><span></span>';
    chatContainer.appendChild(loadingMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Função para remover a mensagem de carregamento
function hideLoading() {
    const loadingMessage = document.getElementById('loading-indicator');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

// Incluir a biblioteca string-similarity
const stringSimilarity = {
    compareTwoStrings: function (first, second) {
        first = first.replace(/\s+/g, '');
        second = second.replace(/\s+/g, '');

        if (first === second) return 1; // identical or empty
        if (first.length < 2 || second.length < 2) return 0; // if either is a 0-letter or 1-letter string

        let firstBigrams = new Map();
        for (let i = 0; i < first.length - 1; i++) {
            const bigram = first.substring(i, i + 2);
            const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;
            firstBigrams.set(bigram, count);
        }

        let intersectionSize = 0;
        for (let i = 0; i < second.length - 1; i++) {
            const bigram = second.substring(i, i + 2);
            const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) - 1 : 0;

            if (count > 0) {
                firstBigrams.set(bigram, count);
                intersectionSize++;
            }
        }

        return (2.0 * intersectionSize) / (first.length + second.length - 2);
    }
};
