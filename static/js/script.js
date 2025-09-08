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
            sqDiv.setAttribute("tabindex", "0");
            sqDiv.setAttribute("aria-label", `Square ${indexToAlgebraic(sqIndex)}`);

            if (boardDict[sqIndex]) {
                const img = document.createElement("img");
                const pieceSymbol = boardDict[sqIndex];
                const pieceColor = pieceSymbol === pieceSymbol.toUpperCase() ? 'w' : 'b';
                img.src = `/static/pieces/${pieceColor}pieces/${pieceSymbol.toLowerCase()}.png`;
                img.alt = `${pieceColor}${pieceSymbol}`;
                img.classList.add("piece");
                img.draggable = true;
                img.onerror = () => {
                    console.error("Image load failed for:", img.src);
                    img.src = "/static/pieces/default.png";
                };
                sqDiv.appendChild(img);
            }
            sqDiv.addEventListener("click", () => onSquareClick(sqIndex));
            sqDiv.addEventListener("dragstart", (e) => onDragStart(e, sqIndex));
            sqDiv.addEventListener("dragover", (e) => e.preventDefault());
            sqDiv.addEventListener("drop", (e) => onDrop(e, sqIndex));
            sqDiv.addEventListener("touchstart", (e) => onTouchStart(e, sqIndex));
            sqDiv.addEventListener("touchmove", (e) => onTouchMove(e));
            sqDiv.addEventListener("touchend", (e) => onTouchEnd(e, sqIndex));
            sqDiv.addEventListener("keydown", (e) => onKeyDown(e, sqIndex));
            boardDiv.appendChild(sqDiv);
        }
    }
    loadingDiv.style.display = "none";
}

function indexToAlgebraic(index) {
    const file = String.fromCharCode(97 + (index % 8));
    const rank = 8 - Math.floor(index / 8);
    return `${file}${rank}`;
}

async function onSquareClick(sq) {
    if (isPaused || isGameOver) return;
    console.log("Square clicked:", sq);
    if (selectedSquare === null) {
        const piece = document.querySelector(`[data-sq="${sq}"] img.piece`);
        if (!piece) return;
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
            console.log("Legal moves:", data.moves);
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
        await makeMove(sq);
    }
}

function onDragStart(e, sq) {
    if (isPaused || isGameOver) return;
    const piece = document.querySelector(`[data-sq="${sq}"] img.piece`);
    if (!piece) return;
    console.log("Drag start:", sq);
    e.dataTransfer.setData("text/plain", sq.toString());
    piece.classList.add("dragging");
    selectedSquare = sq;
    onSquareClick(sq);
}

function onDrop(e, toSquare) {
    e.preventDefault();
    const fromSquare = parseInt(e.dataTransfer.getData("text/plain"));
    document.querySelectorAll(".dragging").forEach(el => el.classList.remove("dragging"));
    console.log("Drop: from %s to %s", fromSquare, toSquare);
    if (fromSquare !== toSquare) {
        makeMove(toSquare, fromSquare);
    }
}

let touchStartSquare = null;
function onTouchStart(e, sq) {
    if (isPaused || isGameOver) return;
    const piece = document.querySelector(`[data-sq="${sq}"] img.piece`);
    if (!piece) return;
    console.log("Touch start:", sq);
    touchStartSquare = sq;
    piece.classList.add("dragging");
    onSquareClick(sq);
}

function onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    document.querySelectorAll(".hover").forEach(el => el.classList.remove("hover"));
    if (element && element.classList.contains("square")) {
        element.classList.add("hover");
    }
}

function onTouchEnd(e, toSquare) {
    document.querySelectorAll(".dragging").forEach(el => el.classList.remove("dragging"));
    document.querySelectorAll(".hover").forEach(el => el.classList.remove("hover"));
    console.log("Touch end:", toSquare);
    if (touchStartSquare !== null && touchStartSquare !== toSquare) {
        makeMove(toSquare, touchStartSquare);
    }
    touchStartSquare = null;
}

function onKeyDown(e, sq) {
    if (isPaused || isGameOver) return;
    const file = sq % 8;
    const rank = Math.floor(sq / 8);
    let newSquare = sq;
    if (e.key === "ArrowUp" && rank < 7) newSquare = (rank + 1) * 8 + file;
    if (e.key === "ArrowDown" && rank > 0) newSquare = (rank - 1) * 8 + file;
    if (e.key === "ArrowLeft" && file > 0) newSquare = rank * 8 + (file - 1);
    if (e.key === "ArrowRight" && file < 7) newSquare = rank * 8 + (file + 1);
    if (e.key === "Enter") {
        onSquareClick(sq);
        return;
    }
    if (newSquare !== sq) {
        console.log("Keyboard move to:", newSquare);
        const newEl = document.querySelector(`[data-sq="${newSquare}"]`);
        if (newEl) newEl.focus();
    }
}

async function makeMove(toSquare, fromSquare = selectedSquare) {
    if (isPaused || isGameOver || fromSquare === null) return;
    console.log("Making move: from %s to %s", fromSquare, toSquare);
    try {
        const res = await fetch("/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: fromSquare, to: toSquare })
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
        if (data.ai_move) lm += " | " + data.ai_move;
        document.getElementById("last-move").innerText = lm || "No moves yet";
        selectedSquare = null;
        if (data.status.includes("Checkmate") || data.status.includes("Stalemate") ||
            data.status.includes("Draw")) {
            isGameOver = true;
            clearInterval(timerInterval);
            timerInterval = null;
        }
    } catch (error) {
        console.error("Move error:", error);
        errorMsgDiv.innerText = `Move error: ${error.message}`;
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
        document.getElementById("menu").style.display = "none";
    } catch (error) {
        console.error("Reset error:", error);
        errorMsgDiv.innerText = `Reset error: ${error.message}`;
    }
}

async function quitGame() {
    if (isPaused) togglePause();
    try {
        errorMsgDiv.innerText = "";
        const res = await fetch("/reset", { method: "POST" });
        if (!res.ok) {
            console.error(`Reset failed: HTTP status ${res.status}`);
            return;
        }
        const data = await res.json();
        if (data.error) {
            console.error("Reset error:", data.error);
            return;
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
