async function convert() {
    const amount = document.getElementById('amount').value;
    const fromCurrency = document.getElementById('fromCurrency').value;
    const toCurrency = document.getElementById('toCurrency').value;
    const errorElement = document.getElementById('error');
    const resultElement = document.getElementById('result');

    // Clear previous error and result
    errorElement.textContent = '';
    resultElement.value = '';

    // Validate input
    if (!amount || amount <= 0) {
        errorElement.textContent = 'Please enter a valid amount';
        return;
    }

    try {
        const response = await fetch(`/api/convert?from=${fromCurrency}&to=${toCurrency}&amount=${amount}`);
        const data = await response.json();

        if (response.ok) {
            resultElement.value = data.converted_amount.toFixed(2);
            // Clear any previous error
            errorElement.textContent = '';
        } else {
            errorElement.textContent = data.error || 'An error occurred while converting currencies';
        }
    } catch (error) {
        errorElement.textContent = 'Error connecting to the server. Please try again later.';
        console.error('Error:', error);
    }
}

function swapCurrencies() {
    const fromCurrency = document.getElementById('fromCurrency');
    const toCurrency = document.getElementById('toCurrency');
    const temp = fromCurrency.value;
    fromCurrency.value = toCurrency.value;
    toCurrency.value = temp;
    
    // Clear result when currencies are swapped
    document.getElementById('result').value = '';
    document.getElementById('error').textContent = '';
}

// Currency conversion functionality
const amountInput = document.getElementById('amount');
const fromCurrency = document.getElementById('from-currency');
const toCurrency = document.getElementById('to-currency');
const convertBtn = document.getElementById('convert-btn');
const resultDisplay = document.getElementById('result-display');
const loadingIndicator = document.getElementById('loading-indicator');
const exchangeRateElement = document.getElementById('exchange-rate');
const lastUpdatedElement = document.getElementById('last-updated');
const errorMessage = document.getElementById('error-message');
const swapBtn = document.getElementById('swap-btn');

let exchangeRates = {};
let lastUpdateTime = null;

// Configuration
const API_BASE_URL = ''; // Remove the explicit URL since nginx will handle the routing

// Function to fetch exchange rates
async function fetchExchangeRates() {
    try {
        loadingIndicator.style.display = 'flex';
        errorMessage.classList.remove('show');
        
        const from = fromCurrency.value;
        const to = toCurrency.value;
        
        const response = await fetch(`/api/exchange-rate?from=${from}&to=${to}`);
        if (!response.ok) {
            throw new Error('Failed to fetch exchange rates');
        }
        
        const data = await response.json();
        exchangeRates = {
            [from]: 1,
            [to]: data.rate
        };
        lastUpdateTime = new Date(data.timestamp);
        
        updateExchangeRateInfo();
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.add('show');
        console.error('Error:', error);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Update the exchange rate information display
function updateExchangeRateInfo() {
    if (lastUpdateTime) {
        const from = fromCurrency.value;
        const to = toCurrency.value;
        const fromFlag = fromCurrency.options[fromCurrency.selectedIndex].text.split(' ')[0];
        const toFlag = toCurrency.options[toCurrency.selectedIndex].text.split(' ')[0];
        const rate = exchangeRates[to] / exchangeRates[from];
        
        exchangeRateElement.textContent = `${fromFlag} 1 ${from} = ${toFlag} ${rate.toFixed(6)} ${to}`;
        lastUpdatedElement.textContent = `Last updated: ${lastUpdateTime.toLocaleString()}`;
    }
}

// Function to convert currency
async function convertCurrency() {
    try {
        loadingIndicator.style.display = 'flex';
        errorMessage.classList.remove('show');
        convertBtn.disabled = true;
        
        const amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('Please enter a valid amount');
        }
        
        const from = fromCurrency.value;
        const to = toCurrency.value;
        const fromFlag = fromCurrency.options[fromCurrency.selectedIndex].text.split(' ')[0];
        const toFlag = toCurrency.options[toCurrency.selectedIndex].text.split(' ')[0];
        
        const response = await fetch(`/api/convert?from=${from}&to=${to}&amount=${amount}`);
        if (!response.ok) {
            throw new Error('Failed to convert currency');
        }
        
        const data = await response.json();
        const convertedAmount = data.converted_amount;
        
        resultDisplay.innerHTML = `
            <h3>Conversion Result</h3>
            <p>${fromFlag} ${amount.toLocaleString()} ${from} = ${toFlag} ${convertedAmount.toLocaleString()} ${to}</p>
        `;
        
        updateExchangeRateInfo();
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.add('show');
        console.error('Error:', error);
    } finally {
        loadingIndicator.style.display = 'none';
        convertBtn.disabled = false;
    }
}

// Event listeners
convertBtn.addEventListener('click', convertCurrency);
fromCurrency.addEventListener('change', updateExchangeRateInfo);
toCurrency.addEventListener('change', updateExchangeRateInfo);
swapBtn.addEventListener('click', swapCurrencies);

// Initial fetch of exchange rates
fetchExchangeRates();

document.addEventListener('DOMContentLoaded', () => {
    const fromCurrency = document.getElementById('from-currency');
    const toCurrency = document.getElementById('to-currency');
    const amountInput = document.getElementById('amount');
    const convertBtn = document.getElementById('convert-btn');
    const swapBtn = document.getElementById('swap-btn');
    const resultDiv = document.getElementById('result');
    const exchangeRateInfo = document.getElementById('exchange-rate-info');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');

    // Function to swap currencies
    const swapCurrencies = () => {
        const temp = fromCurrency.value;
        fromCurrency.value = toCurrency.value;
        toCurrency.value = temp;
        // Trigger conversion after swap
        convertCurrency();
    };

    // Add click event listener to swap button
    swapBtn.addEventListener('click', swapCurrencies);
}); 