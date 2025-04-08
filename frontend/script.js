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