let currentRoomId = null;
let currentUserId = null;
let currentMovieId = null;
const currentYear = new Date().getFullYear();
let roomStatusInterval = null;
let votingTimer = null;
let votingEndTime = null;
let selectedYears = [];
let selectedGenres = [];

async function createRoom() {
    document.getElementById('create-room-form').style.display = 'block';
    document.getElementById('join-room-form').style.display = 'none';
}

async function submitCreateRoom() {
    const startYear = document.getElementById('start-year').value;
    const endYear = document.getElementById('end-year').value;
    
    // Store the selected values
    selectedGenres = Array.from(document.querySelectorAll('.genre-checkbox input:checked'))
        .map(checkbox => checkbox.value);
    selectedYears = Array.from(
        { length: parseInt(endYear) - parseInt(startYear) + 1 },
        (_, i) => parseInt(startYear) + i
    );

    try {
        const createResponse = await fetch('/api/rooms', {
            method: 'POST'
        });
        const roomData = await createResponse.json();
        currentRoomId = roomData.room_id;

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
        document.getElementById('waiting-room-section').style.display = 'block';
        
        // Apply stored configuration if this user created the room
        if (selectedYears.length > 0) {
            await fetch('/api/room-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    roomId: currentRoomId,
                    years: selectedYears,
                    genres: selectedGenres
                })
            });
        }
        
        startRoomStatusPolling();
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
        
        if (data.status === 'voting_ended') {
            showResults();
        }  else if (data.status === 'seeding_complete') {
            // All users finished seeding, start the voting phase
            document.getElementById('learning-phase').style.display = 'none';
            document.getElementById('voting-phase').style.display = 'block';
            // Start the timer now
            fetch(`/api/room-status?roomId=${currentRoomId}`)
                .then(response => response.json())
                .then(data => {
                    startVotingTimer(data.config.voting_duration);
                    getNextMovie();
                });
        } else if (data.status === 'user_seeding_complete') {
            // Keep learning phase visible but show waiting message
            document.getElementById('learning-phase').innerHTML = `
                <h2>Learning Phase Complete!</h2>
                <p>Waiting for other users to finish...</p>
            `;
            document.getElementById('movie-info').innerHTML = '';  // Clear movie info
            document.querySelector('.voting-buttons').style.display = 'none';  // Hide voting buttons
            // Important: Don't hide learning phase div so room status polling can detect it
            console.log("Starting room status polling because this user it ready for next state");
            setInterval(updateRoomStatus, 3000);

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
    document.getElementById('waiting-room-section').style.display = 'none';
    document.getElementById('voting-section').style.display = 'block';
    document.getElementById('learning-phase').style.display = 'block';
    document.getElementById('voting-phase').style.display = 'none';
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

function startRoomStatusPolling() {
    console.log("Starting room status polling");
    updateRoomStatus(); // Initial update
    roomStatusInterval = setInterval(updateRoomStatus, 3000); // Update every 3 seconds
}

async function updateRoomStatus() {
    console.log("Updating room status");
    try {
        const response = await fetch(`/api/room-status?roomId=${currentRoomId}`);
        const data = await response.json();
        
        // Update room ID display
        const roomIdDisplay = document.getElementById('room-id-display');
        roomIdDisplay.innerHTML = `Room ID: ${data.roomId}`;
        
        // Update users list
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = data.users
            .map(user => `<li>${user.name}</li>`)
            .join('');
        
        // Update room configuration
        const roomConfig = document.getElementById('room-config');
        const config = data.config;
        roomConfig.innerHTML = `
            <p><strong>Years:</strong> ${Math.min(...config.years)} - ${Math.max(...config.years)}</p>
            ${config.genres.length ? `<p><strong>Genres:</strong> ${config.genres.join(', ')}</p>` : ''}
        `;

        const votingSection = document.getElementById('voting-section');
        const learningPhase = document.getElementById('learning-phase');
        const votingPhase = document.getElementById('voting-phase');

        // If seeding is complete and we're still in learning phase, transition to voting
        if (data.seedingComplete && 
            document.getElementById('voting-section').style.display === 'block' && 
            document.getElementById('learning-phase').style.display !== 'none') {
            
            document.getElementById('learning-phase').style.display = 'none';
            document.getElementById('voting-phase').style.display = 'block';
            document.querySelector('.voting-buttons').style.display = 'block';  // Re-enable voting buttons
            
            // Start the timer now
            startVotingTimer(data.config.voting_duration);
            getNextMovie();
        }
        
        // If voting has started, transition from waiting room
        if (data.votingStarted && document.getElementById('waiting-room-section').style.display !== 'none') {
            clearInterval(roomStatusInterval);
            startVoting();
        }
    } catch (error) {
        console.error('Error updating room status:', error);
    }
}

function confirmStartVoting() {
    if (confirm('Are all users in the room? This will start voting for everyone.')) {
        startVotingForAll();
    }
}

async function startVotingForAll() {
    const votingDuration = document.getElementById('voting-timer').value * 60;
    if (!votingDuration) {
        alert('Please set a voting duration before starting');
        return;
    }

    try {
        // First update room config with voting duration
        await fetch('/api/room-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomId: currentRoomId,
                years: selectedYears,
                genres: selectedGenres,
                votingDuration: votingDuration
            })
        });

        // Then start voting
        await fetch('/api/start-voting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: currentRoomId })
        });
        
        clearInterval(roomStatusInterval);
        startVoting();
    } catch (error) {
        alert('Error starting voting: ' + error.message);
    }
}

function updateTimerDisplay() {
    const minutes = document.getElementById('voting-timer').value;
    const minutesInt = Math.floor(minutes);
    const seconds = Math.round((minutes - minutesInt) * 60);
    document.getElementById('timer-display').textContent = 
        `${minutesInt}:${seconds.toString().padStart(2, '0')}`;
}

function startVotingTimer(duration) {
    votingEndTime = Date.now() + (duration * 1000);
    
    // Create timer display element
    const timerElement = document.createElement('div');
    timerElement.className = 'timer-countdown';
    document.body.appendChild(timerElement);
    
    votingTimer = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, votingEndTime - now);
        
        if (timeLeft === 0) {
            clearInterval(votingTimer);
            clearInterval(roomStatusInterval);
            showResults();
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Add new function to update room configuration with timer
async function updateRoomConfig() {
    const votingDuration = document.getElementById('voting-timer').value * 60; // Convert to seconds
    
    try {
        // First get current config
        const statusResponse = await fetch(`/api/room-status?roomId=${currentRoomId}`);
        const statusData = await statusResponse.json();
        const currentConfig = statusData.config;

        // Then update with new voting duration while preserving existing config
        const response = await fetch('/api/room-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomId: currentRoomId,
                years: currentConfig.years,  // Include existing years
                genres: currentConfig.genres,  // Include existing genres
                votingDuration: votingDuration
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update room configuration');
        }
    } catch (error) {
        alert('Error updating room configuration: ' + error.message);
    }
}

// Add event listener for timer changes
document.getElementById('voting-timer').addEventListener('input', () => {
    updateTimerDisplay();
    updateRoomConfig();
});

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
    document.getElementById('voting-timer').addEventListener('input', updateTimerDisplay);
}); 