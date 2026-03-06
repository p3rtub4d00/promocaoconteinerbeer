document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('scratchCanvas');
    const ctx = canvas.getContext('2d');
    const prizeText = document.getElementById('prizeText');
    const playBtn = document.getElementById('playBtn');

    let isDrawing = false;
    let prize = "";

    playBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/play', { method: 'POST' });
            const data = await response.json();

            if (data.error) {
                alert(data.error);
                return;
            }

            prize = data.prize;
            prizeText.innerText = prize;
            setupCanvas();
            playBtn.style.display = 'none';
        } catch (err) {
            console.error("Erro de conexão", err);
        }
    });

    function setupCanvas() {
        ctx.fillStyle = '#f36c21';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Raspe Aqui', canvas.width / 2, canvas.height / 2);

        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 40;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', stopDrawing);
    }

    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);

        checkCompletion();
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }

    function checkCompletion() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let clearPixels = 0;
        const totalPixels = imageData.data.length / 4;

        for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] === 0) {
                clearPixels++;
            }
        }

        const clearPercentage = (clearPixels / totalPixels) * 100;

        if (clearPercentage > 60) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.pointerEvents = 'none';
            if (window.showVictoryUI) window.showVictoryUI(prize);
        }
    }
});
