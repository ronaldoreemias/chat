// Função para normalizar o texto removendo acentos e caracteres especiais
function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Função para calcular a distância de Levenshtein entre duas strings
function levenshteinDistance(a, b) {
    const matrix = [];

    // Inicializar a matriz
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Preencher a matriz
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // Substituição
                                        Math.min(matrix[i][j - 1] + 1, // Inserção
                                                 matrix[i - 1][j] + 1)); // Deleção
            }
        }
    }

    return matrix[b.length][a.length];
}

// Função para calcular a similaridade de strings usando a distância de Levenshtein
function calculateSimilarity(str1, str2) {
    const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    str1 = normalize(str1);
    str2 = normalize(str2);

    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0; // Tratar o caso onde ambas strings são vazias

    const distance = levenshteinDistance(str1, str2);
    return 1.0 - (distance / maxLen); // Normalizar para um intervalo entre 0 e 1
}

let awaitingUserResponse = false;
let currentQuestion = '';

// Carregar respostas salvas do localStorage
let savedResponses = JSON.parse(localStorage.getItem('savedResponses')) || {};

// Função para processar a entrada do usuário
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

// Função para busca no DuckDuckGo
async function searchDuckDuckGo(query) {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&t=h_&ia=web`);
    if (!response.ok) {
        throw new Error('Erro na solicitação de busca');
    }
    const data = await response.json();
    return data.RelatedTopics.slice(0, 3);
}

// Função para busca na Wikipedia
async function searchWikipedia(query) {
    const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`);
    if (!response.ok) {
        throw new Error('Erro na solicitação de busca');
    }
    const data = await response.json();
    return data.query.search.slice(0, 3).map(result => ({
        title: result.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`,
        snippet: result.snippet
    }));
}

async function searchAndDisplayResults(query) {
    try {
        // Buscar resultados no DuckDuckGo
        const duckDuckGoResults = await searchDuckDuckGo(query);
        // Buscar resultados na Wikipedia
        const wikiResults = await searchWikipedia(query);

        let responses = '';

        // Exibir resultados do DuckDuckGo
        if (duckDuckGoResults.length > 0) {
            responses += '<strong>Resultados do DuckDuckGo:</strong>';
            duckDuckGoResults.forEach((result, index) => {
                if (result.FirstURL && result.Text) {
                    responses += `
                        <div>
                            <strong>Opção ${index + 1}:</strong> <a href="${result.FirstURL}" target="_blank">${result.Text}</a>
                        </div>
                    `;
                }
            });
        }

        // Exibir resultados da Wikipedia
        if (wikiResults.length > 0) {
            responses += '<br/><strong>Resultados da Wikipedia:</strong>';
            wikiResults.forEach((result, index) => {
                responses += `
                    <div>
                        <strong>Opção ${index + 1}:</strong> <a href="${result.url}" target="_blank">${result.title}</a><br/>${result.snippet}
                    </div>
                `;
            });
        }

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
    messageBubble.innerHTML = message;
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
