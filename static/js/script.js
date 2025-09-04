let selectedSquare = null;
const boardDiv = document.getElementById("board");
const statusDiv = document.getElementById("status");

function createBoard(boardDict) {
    boardDiv.innerHTML = "";
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
                
                // Determine the piece color based on the symbol's case
                const pieceColor = pieceSymbol === pieceSymbol.toUpperCase() ? 'w' : 'b';
                
                // Use the new folder structure and correct file names
                img.src = `/static/pieces/${pieceColor}pieces/${pieceSymbol}.png`;
                img.classList.add("piece");
                sqDiv.appendChild(img);
            }
            sqDiv.addEventListener("click", () => onSquareClick(sqIndex));
            boardDiv.appendChild(sqDiv);
        }
    }
}

async function onSquareClick(sq) {
    if (selectedSquare === null) {
        selectedSquare = sq;
    } else {
        const res = await fetch("/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: selectedSquare, to: sq })
        });
        const data = await res.json();
        if (res.ok) {
            createBoard(data.board);
            statusDiv.innerText = data.status;
        } else {
            alert(data.error);
        }
        selectedSquare = null;
    }
}

async function resetBoard() {
    const res = await fetch("/reset", { method: "POST" });
    const data = await res.json();
    createBoard(data.board);
    statusDiv.innerText = data.status;
}

async function undoMove() {
    const res = await fetch("/undo", { method: "POST" });
    const data = await res.json();
    createBoard(data.board);
    statusDiv.innerText = data.status;
}

window.onload = resetBoard;