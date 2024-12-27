let currentRoomId = null;
let currentUserId = null;
let currentMovieId = null;
const currentYear = new Date().getFullYear();

async function createRoom() {
    document.getElementById('create-room-form').style.display = 'block';
    document.getElementById('join-room-form').style.display = 'none';
}

async function submitCreateRoom() {
    const startYear = document.getElementById('start-year').value;
    const endYear = document.getElementById('end-year').value;
    const selectedGenres = Array.from(document.querySelectorAll('.genre-checkbox input:checked'))
        .map(checkbox => checkbox.value);

    // Validate years
    if (!startYear || !endYear) {
        alert('Please enter both start and end years');
        return;
    }

    if (parseInt(startYear) > parseInt(endYear)) {
        alert('Start year must be less than or equal to end year');
        return;
    }

    try {
        // First create the room
        const createResponse = await fetch('/api/rooms', {
            method: 'POST'
        });
        const roomData = await createResponse.json();
        currentRoomId = roomData.room_id;

        // Generate array of years
        const years = Array.from(
            { length: parseInt(endYear) - parseInt(startYear) + 1 },
            (_, i) => parseInt(startYear) + i
        );

        // Then update the room configuration
        const configResponse = await fetch('/api/room-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomId: currentRoomId,
                years: years,
                genres: selectedGenres
            })
        });
        
        if (!configResponse.ok) {
            throw new Error('Failed to update room configuration');
        }

        alert(`Room created! Room ID: ${currentRoomId}`);
        document.getElementById('username-form').style.display = 'block';
    } catch (error) {
        alert('Error creating room: ' + error.message);
    }
}

function showJoinRoom() {
    document.getElementById('join-room-form').style.display = 'block';
    document.getElementById('create-room-form').style.display = 'none';
}

function setRoomId() {
    currentRoomId = document.getElementById('room-id').value;
    document.getElementById('username-form').style.display = 'block';
}

async function joinRoom() {
    const userName = document.getElementById('username').value;
    if (!userName || !currentRoomId) {
        alert('Please enter both room ID and username');
        return;
    }

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: currentRoomId, userName })
        });
        const data = await response.json();
        currentUserId = data.user_id;
        
        document.getElementById('setup-section').style.display = 'none';
        document.getElementById('voting-section').style.display = 'block';
        
        startVoting();
    } catch (error) {
        alert('Error joining room: ' + error.message);
    }
}

async function getNextMovie() {
    try {
        const response = await fetch(`/api/movies?userId=${currentUserId}`);
        const data = await response.json();
        currentMovieId = data.movie_id;
        
        document.getElementById('movie-info').innerHTML = `
            <h3>${data.title}</h3>
            <p>Movie ID: <a href="https://www.imdb.com/title/tt${data.movie_id}" target="_blank">${data.movie_id}</a></p>
        `;
    } catch (error) {
        if (error.message.includes('404')) {
            setTimeout(getNextMovie, 2000);
        } else {
            alert('Error getting next movie: ' + error.message);
        }
    }
}

async function vote(voteType) {
    try {
        const response = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUserId,
                movieId: currentMovieId,
                vote: voteType
            })
        });
        const data = await response.json();
        
        if (data.status === 'seeding_complete') {
            showResults();
        } else if (data.status === 'user_seeding_complete') {
            alert('You have completed voting! Waiting for other users...');
        } else {
            getNextMovie();
        }
    } catch (error) {
        alert('Error submitting vote: ' + error.message);
    }
}

async function showResults() {
    try {
        const response = await fetch(`/api/recommendations?userId=${currentUserId}`);
        const data = await response.json();
        
        document.getElementById('voting-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'block';
        
        let html = '<h3>Top Movies:</h3><ul>';
        data.topMovies.forEach(movieId => {
            html += `<li>${data.movieTitles[movieId]}</li>`;
        });
        html += '</ul><h3>User Queues:</h3>';
        
        Object.entries(data.userQueues).forEach(([userId, queue]) => {
            html += `<h4>User ${userId}</h4><ul>`;
            queue.forEach(movieId => {
                html += `<li>${data.movieTitles[movieId]}</li>`;
            });
            html += '</ul>';
        });
        
        document.getElementById('recommendations').innerHTML = html;
    } catch (error) {
        alert('Error getting recommendations: ' + error.message);
    }
}

function startVoting() {
    getNextMovie();
}

function updateSelectedGenres() {
    const selectedGenres = Array.from(document.querySelectorAll('.genre-checkbox input:checked'))
        .map(checkbox => checkbox.value);
    const selectedGenresDiv = document.querySelector('.selected-genres');
    
    if (selectedGenres.length > 0) {
        selectedGenresDiv.textContent = `Selected: ${selectedGenres.join(', ')}`;
    } else {
        selectedGenresDiv.textContent = '';
    }
}

function validateYearInputs() {
    const startYear = document.getElementById('start-year').value;
    const endYear = document.getElementById('end-year').value;
    const createButton = document.getElementById('create-room-button');
    
    if (startYear && endYear && 
        parseInt(startYear) >= 1900 && 
        parseInt(endYear) <= currentYear && 
        parseInt(startYear) <= parseInt(endYear)) {
        createButton.disabled = false;
    } else {
        createButton.disabled = true;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Update max year attributes
    const yearInputs = document.querySelectorAll('input[type="number"]');
    yearInputs.forEach(input => {
        input.max = currentYear;
    });
    
    document.querySelectorAll('.genre-checkbox input').forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedGenres);
    });
    
    document.getElementById('start-year').addEventListener('input', validateYearInputs);
    document.getElementById('end-year').addEventListener('input', validateYearInputs);
}); 