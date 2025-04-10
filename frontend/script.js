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

// Function to swap currencies
function swapCurrencies() {
    const fromValue = document.getElementById('from-currency').value;
    const toValue = document.getElementById('to-currency').value;
    
    document.getElementById('from-currency').value = toValue;
    document.getElementById('to-currency').value = fromValue;
    
    fetchExchangeRates();
    
    // Add animation class
    document.getElementById('swap-btn').classList.add('active');
    
    // Remove animation class after animation completes
    setTimeout(() => {
        document.getElementById('swap-btn').classList.remove('active');
    }, 300);
}

let exchangeRates = {};
let lastUpdateTime = null;

// Configuration
const API_BASE_URL = '/api'; // Add the /api prefix

// Function to get flag emoji from currency code
function getCurrencyFlag(currencyCode) {
    currencyCode = currencyCode.toUpperCase();
    if (currencyCode === 'EUR') return '🇪🇺';
    if (currencyCode === 'GBP') return '🇬🇧';
    if (currencyCode === 'USD') return '🇺🇸';
    if (currencyCode === 'JPY') return '🇯🇵';
    if (currencyCode === 'CNY') return '🇨🇳';
    if (currencyCode === 'AUD') return '🇦🇺';
    if (currencyCode === 'CAD') return '🇨🇦';
    if (currencyCode === 'CHF') return '🇨🇭';
    if (currencyCode === 'HKD') return '🇭🇰';
    if (currencyCode === 'SGD') return '🇸🇬';
    if (currencyCode === 'SEK') return '🇸🇪';
    if (currencyCode === 'KRW') return '🇰🇷';
    if (currencyCode === 'NOK') return '🇳🇴';
    if (currencyCode === 'NZD') return '🇳🇿';
    if (currencyCode === 'INR') return '🇮🇳';
    if (currencyCode === 'MXN') return '🇲🇽';
    if (currencyCode === 'TWD') return '🇹🇼';
    if (currencyCode === 'ZAR') return '🇿🇦';
    if (currencyCode === 'BRL') return '🇧🇷';
    if (currencyCode === 'DKK') return '🇩🇰';
    return '🏳️';
}

// Function to fetch exchange rates
async function fetchExchangeRates() {
    try {
        loadingIndicator.style.display = 'flex';
        errorMessage.classList.remove('show');
        
        const from = fromCurrency.value;
        const to = toCurrency.value;
        
        const response = await fetch(`${API_BASE_URL}/exchange-rate?from=${from}&to=${to}`);
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
        const rate = exchangeRates[to] / exchangeRates[from];
        const fromFlag = getCurrencyFlag(from);
        const toFlag = getCurrencyFlag(to);
        
        exchangeRateElement.innerHTML = `
            ${fromFlag} 1 ${from} = ${toFlag} ${rate.toFixed(6)} ${to}
        `;
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
        
        const response = await fetch(`${API_BASE_URL}/convert?from=${from}&to=${to}&amount=${amount}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Failed to convert currency (Status: ${response.status})`);
        }
        
        try {
            const data = await response.json();
            const convertedAmount = data.converted_amount;
            
            resultDisplay.innerHTML = `
                <h3>Conversion Result</h3>
                <p>
                    ${getCurrencyFlag(from)} ${amount.toLocaleString()} ${from} = 
                    ${getCurrencyFlag(to)} ${convertedAmount.toLocaleString()} ${to}
                </p>
            `;
            
            updateExchangeRateInfo();
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Failed to parse server response');
        }
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
fromCurrency.addEventListener('change', fetchExchangeRates);
toCurrency.addEventListener('change', fetchExchangeRates);
swapBtn.addEventListener('click', swapCurrencies);

// Initial fetch of exchange rates
fetchExchangeRates(); 