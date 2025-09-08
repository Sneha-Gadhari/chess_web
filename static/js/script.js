let selectedSquare = null;
const boardDiv = document.getElementById("board");
const statusDiv = document.getElementById("status");
const errorMsgDiv = document.getElementById("error-msg");
const loadingDiv = document.getElementById("loading");
let isPaused = false;
let gameTime = 0;
let timerInterval = null;
let isGameOver = false;

function createBoard(boardDict) {
    if (!boardDiv) {
        console.error("Board div not found");
        errorMsgDiv.innerText = "Board element not found.";
        return;
    }
    boardDiv.innerHTML = "";
    if (!boardDict || Object.keys(boardDict).length === 0) {
        console.warn("Empty or invalid boardDict:", boardDict);
        errorMsgDiv.innerText = "Invalid board data received.";
        return;
    }
    for (let r = 7; r >= 0; r--) {
        for (let f = 0; f < 8; f++) {
            const sqIndex = r * 8 + f;
            const sqDiv = document.createElement("div");
            sqDiv.classList.add("square");
            sqDiv.classList.add((r + f) % 2 === 0 ? "light" : "dark");
            sqDiv.dataset.sq = sqIndex;

            if (boardDict[sqIndex]) {
                const img = document.createElement("img");
                const pieceSymbol = boardDict[sqIndex];
                const pieceColor = pieceSymbol === pieceSymbol.toUpperCase() ? 'w' : 'b';
                img.src = `/static/pieces/${pieceColor}pieces/${pieceSymbol.toLowerCase()}.png`;
                img.alt = `${pieceColor}${pieceSymbol}`;
                img.classList.add("piece");
                img.onerror = () => {
                    console.error("Image load failed for:", img.src);
                    img.src = "/static/pieces/default.png";
                };
                sqDiv.appendChild(img);
            }
            sqDiv.addEventListener("click", () => onSquareClick(sqIndex));
            boardDiv.appendChild(sqDiv);
        }
    }
    loadingDiv.style.display = "none";
}

async function onSquareClick(sq) {
    if (isPaused || isGameOver) return;

    if (selectedSquare === null) {
        // Select source square
        const piece = document.querySelector(`[data-sq="${sq}"] img.piece`);
        if (!piece) return; // No piece on this square
        selectedSquare = sq;
        document.querySelectorAll(".selected, .possible").forEach(el => {
            el.classList.remove("selected", "possible");
        });
        const selectedEl = document.querySelector(`[data-sq="${sq}"]`);
        if (selectedEl) selectedEl.classList.add("selected");
        try {
            const res = await fetch("/legal_moves", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from: sq })
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            data.moves.forEach(m => {
                const possibleEl = document.querySelector(`[data-sq="${m}"]`);
                if (possibleEl) possibleEl.classList.add("possible");
            });
        } catch (error) {
            console.error("Legal moves error:", error);
            errorMsgDiv.innerText = `Legal moves error: ${error.message}`;
            selectedSquare = null;
        }
    } else {
        // Attempt move to destination square
        await makeMove(sq);
    }
}

async function makeMove(toSquare) {
    if (isPaused || isGameOver || selectedSquare === null) return;
    try {
        const res = await fetch("/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: selectedSquare, to: toSquare })
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        document.querySelectorAll(".selected, .possible").forEach(el => {
            el.classList.remove("selected", "possible");
        });
        createBoard(data.board);
        statusDiv.innerText = data.status || "Game in progress";
        let lm = data.player_move || "";
        if (data.ai_move) lm += "\n" + data.ai_move;
        document.getElementById("last-move").innerText = lm || "No moves yet";
        selectedSquare = null;
        // Check for game over
        if (data.status.includes("Checkmate") || data.status.includes("Stalemate")) {
            isGameOver = true;
            clearInterval(timerInterval);
            timerInterval = null;
        }
    } catch (error) {
        console.error("Move error:", error);
        errorMsgDiv.innerText = `Move error: ${error.message}`;
        // Clear selection on invalid move
        document.querySelectorAll(".selected, .possible").forEach(el => {
            el.classList.remove("selected", "possible");
        });
        selectedSquare = null;
    }
}

async function resetBoard() {
    if (isPaused) return;
    try {
        const res = await fetch("/reset", { method: "POST" });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        createBoard(data.board);
        statusDiv.innerText = data.status || "White to move";
        document.getElementById("last-move").innerText = "";
        document.querySelectorAll(".selected, .possible").forEach(el => {
            el.classList.remove("selected", "possible");
        });
        selectedSquare = null;
        isGameOver = false;
        gameTime = 0;
        document.getElementById("timer").innerText = "00:00";
        startTimer();
        document.getElementById("menu").style.display = "none"; // Close menu
    } catch (error) {
        console.error("Reset error:", error);
        errorMsgDiv.innerText = `Reset error: ${error.message}`;
    }
}

async function quitGame() {
    if (isPaused) togglePause(); // Resume to allow quitting
    try {
        errorMsgDiv.innerText = ""; // Clear any existing errors
        const res = await fetch("/reset", { method: "POST" });
        if (!res.ok) {
            console.error(`Reset failed: HTTP status ${res.status}`);
            return; // Don't show error on pre-game screen
        }
        const data = await res.json();
        if (data.error) {
            console.error("Reset error:", data.error);
            return; // Don't show error on pre-game screen
        }
        document.getElementById("board-wrap").style.display = "none";
        document.getElementById("pre-game").style.display = "flex";
        document.getElementById("top-left").style.display = "none";
        document.getElementById("top-right").style.display = "none";
        document.getElementById("bottom-left").style.display = "none";
        document.getElementById("bottom-right").style.display = "none";
        document.getElementById("menu").style.display = "none";
        document.getElementById("last-move").innerText = "";
        statusDiv.innerText = "White to move";
        clearInterval(timerInterval);
        timerInterval = null;
        gameTime = 0;
        document.getElementById("timer").innerText = "00:00";
        isGameOver = false;
        selectedSquare = null;
        document.querySelectorAll(".selected, .possible").forEach(el => {
            el.classList.remove("selected", "possible");
        });
    } catch (error) {
        console.error("Quit error:", error);
        // Don't show error on pre-game screen
    }
}

async function undoMove() {
    if (isPaused || isGameOver) return;
    try {
        const res = await fetch("/undo", { method: "POST" });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        createBoard(data.board);
        statusDiv.innerText = data.status || "White to move";
        document.getElementById("last-move").innerText = "";
        document.querySelectorAll(".selected, .possible").forEach(el => {
            el.classList.remove("selected", "possible");
        });
        selectedSquare = null;
        isGameOver = false;
    } catch (error) {
        console.error("Undo error:", error);
        errorMsgDiv.innerText = `Undo error: ${error.message}`;
    }
}

function startGame() {
    const diff = document.getElementById("difficulty").value;
    loadingDiv.style.display = "block";
    errorMsgDiv.innerText = "";
    fetch("/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: diff })
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data.error) throw new Error(data.error);
        createBoard(data.board);
        statusDiv.innerText = data.status || "White to move";
        document.getElementById("pre-game").style.display = "none";
        document.getElementById("board-wrap").style.display = "flex";
        document.getElementById("top-left").style.display = "block";
        document.getElementById("top-right").style.display = "block";
        document.getElementById("bottom-left").style.display = "block";
        document.getElementById("bottom-right").style.display = "block";
        document.getElementById("menu").style.display = "none";
        gameTime = 0;
        document.getElementById("timer").innerText = "00:00";
        isGameOver = false;
        startTimer();
    })
    .catch(error => {
        console.error("Start error:", error);
        errorMsgDiv.innerText = `Failed to start game: ${error.message}`;
        loadingDiv.style.display = "none";
    });
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isPaused && !isGameOver) {
            gameTime++;
            const min = Math.floor(gameTime / 60).toString().padStart(2, "0");
            const sec = (gameTime % 60).toString().padStart(2, "0");
            document.getElementById("timer").innerText = `${min}:${sec}`;
        }
    }, 1000);
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById("pause-btn").innerText = isPaused ? "Resume" : "Pause";
    boardDiv.style.pointerEvents = isPaused ? "none" : "auto";
    if (isPaused) {
        document.getElementById("menu").style.display = "block";
    } else {
        document.getElementById("menu").style.display = "none";
    }
}

document.getElementById("menu-btn").addEventListener("click", () => {
    const menu = document.getElementById("menu");
    menu.style.display = menu.style.display === "none" ? "block" : "none";
});

window.onload = () => {
    document.getElementById("board-wrap").style.display = "none";
    document.getElementById("top-left").style.display = "none";
    document.getElementById("top-right").style.display = "none";
    document.getElementById("bottom-left").style.display = "none";
    document.getElementById("bottom-right").style.display = "none";
};
