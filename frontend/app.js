// app.js

document.addEventListener('DOMContentLoaded', () => {
  // Maximum number of messages to keep in the conversation history
  const MAX_MESSAGES = 20;

  // Unique identifier for sessions
  function generateSessionId() {
      return Date.now().toString();
  }

  // Sessions array
  let sessions = JSON.parse(localStorage.getItem('sessions')) || [];

  // Currently active session ID
  let activeSessionId = localStorage.getItem('activeSessionId') || null;

  // Messages for the active session
  let messages = [];

  // Available models fetched from the backend
  let availableModels = [];

  // Function to fetch models and populate the dropdown
  async function populateModelDropdown() {
      try {
          const token = localStorage.getItem("token");
          if (!token) {
              window.location.href = "login.html";
              return;
          }

          const response = await fetch('http://localhost:7071/api/GetAvailableModels', {
              headers: {
                  "Authorization": `Bearer ${token}`,
              },
          });

          if (response.ok) {
              const data = await response.json();
              console.log('Models fetched:', data.models); // Debugging log
              const modelSelect = document.getElementById('model-select');

              // Clear existing options
              modelSelect.innerHTML = '';

              // Store models
              availableModels = data.models;

              availableModels.forEach(model => {
                  const option = document.createElement('option');
                  option.value = model;
                  option.textContent = model;
                  modelSelect.appendChild(option);
              });

              if (modelSelect.options.length > 0) {
                  document.getElementById('input').disabled = false;
                  document.getElementById('submit').disabled = false;
              }

              // Initialize sessions after models are loaded
              initializeSessions();

          } else {
              const errorData = await response.json();
              alert(`Failed to fetch models: ${errorData.error}`);
              console.error('Failed to fetch models:', errorData);
          }
      } catch (error) {
          console.error('Error fetching models:', error);
          alert('An error occurred while fetching models. Please try again later.');
      }
  }

  // Check authentication on page load
  (async () => {
      const token = localStorage.getItem("token");
      if (!token) {
          window.location.href = "login.html";
      } else {
          // Optional: Verify token expiration
          try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const exp = payload.exp * 1000; // Convert to milliseconds
              if (Date.now() >= exp) {
                  // Token has expired
                  localStorage.removeItem('token');
                  window.location.href = 'login.html';
              } else {
                  // Token is valid, proceed to populate models
                  await populateModelDropdown();
              }
          } catch (e) {
              // Invalid token format
              localStorage.removeItem('token');
              window.location.href = 'login.html';
          }
      }
  })();

  // Initialize sessions and active session
  function initializeSessions() {
      renderSessionList();

      if (activeSessionId) {
          loadActiveSession();
      } else if (sessions.length > 0) {
          activeSessionId = sessions[0].id;
          localStorage.setItem('activeSessionId', activeSessionId);
          loadActiveSession();
      } else {
          // No sessions exist, start with empty messages
          messages = [
              { role: 'system', content: 'You are a helpful assistant.' },
          ];
          // Input fields should be enabled
          disableInput(false);
          // Clear chat area
          clearChatArea();
      }
  }

  // Load the active session's messages
  function loadActiveSession() {
      const activeSession = sessions.find(session => session.id === activeSessionId);
      if (!activeSession) {
          // No active session found, start with empty messages
          messages = [
              { role: 'system', content: 'You are a helpful assistant.' },
          ];
          // Input fields should be enabled
          disableInput(false);
          // Clear chat area
          clearChatArea();
          return;
      }

      messages = activeSession.messages;

      // Enable input fields
      disableInput(false);

      // Display conversation history
      displayConversationHistory();

      // **Focus the input field after loading the session**
      focusInputField();
  }

  // Clear the chat area
  function clearChatArea() {
      const chatBox = document.getElementById("chat-box");
      chatBox.innerHTML = ''; // Clear existing messages
  }

  // Function to disable or enable input fields
  function disableInput(disable) {
      document.getElementById('input').disabled = disable;
      document.getElementById('submit').disabled = disable;
      document.getElementById('attach-btn').disabled = disable;
  }

  // Function to focus the input field
  function focusInputField() {
      const inputField = document.getElementById('input');
      if (inputField) {
          inputField.focus();
      }
  }

  // Render the list of sessions
  function renderSessionList() {
      const sessionList = document.getElementById('session-list');
      sessionList.innerHTML = '';

      sessions.forEach(session => {
          const sessionItem = document.createElement('div');
          sessionItem.className = 'session-item';
          if (session.id === activeSessionId) {
              sessionItem.classList.add('active');
          }

          // Session name
          const sessionName = document.createElement('span');
          sessionName.textContent = session.name || 'New Chat';
          sessionName.style.flex = '1';
          sessionName.addEventListener('click', () => {
              activeSessionId = session.id;
              localStorage.setItem('activeSessionId', activeSessionId);
              renderSessionList();
              loadActiveSession();
          });

          // Delete button
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'X';
          deleteBtn.style.background = 'none';
          deleteBtn.style.border = 'none';
          deleteBtn.style.color = 'white';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation(); // Prevent triggering the session switch
              deleteSession(session.id);
          });

          sessionItem.appendChild(sessionName);
          sessionItem.appendChild(deleteBtn);

          sessionList.appendChild(sessionItem);
      });
  }

  // Create a new chat session
  function createNewSession() {
      const sessionId = generateSessionId();
      const newSession = {
          id: sessionId,
          name: '', // Start with an empty name
          messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
          ],
      };
      sessions.unshift(newSession);
      activeSessionId = sessionId;
      messages = newSession.messages;

      // Save to localStorage
      localStorage.setItem('sessions', JSON.stringify(sessions));
      localStorage.setItem('activeSessionId', activeSessionId);

      renderSessionList();
      loadActiveSession();
  }

  // Delete session function
  function deleteSession(sessionId) {
      sessions = sessions.filter(session => session.id !== sessionId);

      // If the deleted session was active, handle accordingly
      if (activeSessionId === sessionId) {
          activeSessionId = null;
          localStorage.removeItem('activeSessionId');

          if (sessions.length > 0) {
              activeSessionId = sessions[0].id;
              localStorage.setItem('activeSessionId', activeSessionId);
              loadActiveSession();
          } else {
              // No sessions left
              messages = [
                  { role: 'system', content: 'You are a helpful assistant.' },
              ];
              disableInput(false);
              clearChatArea();
          }
      }

      // Save to localStorage
      localStorage.setItem('sessions', JSON.stringify(sessions));

      renderSessionList();
  }

  // Display existing conversation history
  function displayConversationHistory() {
      const chatBox = document.getElementById("chat-box");
      chatBox.innerHTML = ''; // Clear existing messages

      messages.forEach((message, index) => {
          if (index === 0) return; // Skip system message

          const sender = message.role === 'user' ? 'user' : 'assistant';

          if (message.attachments && message.attachments.length > 0) {
              message.attachments.forEach(attachment => {
                  displayAttachment(sender, attachment);
              });
          } else {
              displayMessage(sender, message.content);
          }
      });

      // **Focus the input field after displaying the conversation**
      focusInputField();
  }

  // Function to show or hide the loading indicator
  function setLoadingIndicator(visible) {
      const loadingIndicator = document.getElementById('loading-indicator');
      loadingIndicator.style.display = visible ? 'block' : 'none';
  }

  // Event listener for the Attach button
  document.getElementById('attach-btn').addEventListener('click', () => {
      document.getElementById('file-input').click();
  });

  // Event listener for File Input change
  document.getElementById('file-input').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (file) {
          await handleAttachment(file);
          event.target.value = ''; // Clear the file input
      }
  });

  // Function to handle attachments
  async function handleAttachment(file) {
      try {
          const base64 = await convertFileToBase64(file);
          // Add attachment to conversation history
          messages.push({
              role: 'user',
              content: '', // No text content for attachments
              attachments: [
                  {
                      name: file.name,
                      type: file.type,
                      data: base64
                  }
              ]
          });

          // Display the attachment in the chat
          displayAttachment("user", {
              name: file.name,
              type: file.type,
              data: base64
          });

          // Save conversation history to sessions
          updateSessionMessages();

          // **Focus the input field after attaching a file**
          focusInputField();
      } catch (error) {
          console.error('Error handling attachment:', error);
          alert('An error occurred while processing the attachment.');
      }
  }

  // Helper function to convert file to Base64
  function convertFileToBase64(file) {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
              const base64String = reader.result.split(',')[1]; // Remove the data URL part
              resolve(base64String);
          };
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
      });
  }

  // Send Message
  async function sendMessage(event) {
      if (event) event.preventDefault();

      const userInput = document.getElementById("input").value;
      const selectedModel = document.getElementById("model-select").value;

      if (!userInput.trim() && !hasAttachments()) return; // Prevent sending empty messages

      // If there is no active session, create one
      if (!activeSessionId) {
          createNewSession();
      }

      // Add user message to conversation history
      const messagePayload = {
          role: 'user',
          content: userInput.trim(),
          attachments: getAttachments()
      };
      messages.push(messagePayload);

      // Display user message in chat box
      displayMessage("user", userInput);
      document.getElementById("input").value = '';

      // Clear attachments after sending
      clearAttachments();

      // **Update session name after the first user message**
      if (messages.length === 2 && userInput.trim()) { // messages[0] is the system message
          updateSessionNameFromMessage(userInput);
      }

      // Limit the number of messages
      if (messages.length > MAX_MESSAGES) {
          // Keep the system message and the last (MAX_MESSAGES - 1) messages
          messages = [messages[0], ...messages.slice(- (MAX_MESSAGES - 1))];
      }

      // Save conversation history to sessions
      updateSessionMessages();

      // Prepare data to send to server
      const payload = {
          messages: messages,
          model: selectedModel,
      };

      try {
          const token = localStorage.getItem("token");
          if (!token) {
              window.location.href = "login.html";
              return;
          }

          // Disable input and show the loading indicator
          disableInput(true);
          setLoadingIndicator(true);

          const res = await fetch("http://localhost:7071/api/ChatHandler", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                  "Accept": "application/json",
              },
              body: JSON.stringify(payload),
          });

          // Enable input and hide the loading indicator
          disableInput(false);
          setLoadingIndicator(false);

          if (res.ok) {
              const data = await res.json();

              // Add assistant's response to conversation history
              messages.push({ role: 'assistant', content: data.response });

              // Limit the number of messages
              if (messages.length > MAX_MESSAGES) {
                  messages = [messages[0], ...messages.slice(- (MAX_MESSAGES - 1))];
              }

              // Save conversation history to sessions
              updateSessionMessages();

              displayMessage("assistant", data.response);
          } else {
              const error = await res.json();
              displayMessage("assistant", `Error: ${error.error || 'An error occurred'}`);
              if (res.status === 401) {
                  // Token might be invalid or expired
                  localStorage.removeItem("token");
                  localStorage.removeItem("sessions"); // Clear sessions
                  localStorage.removeItem("activeSessionId");
                  window.location.href = "login.html";
              }
          }

          // **Focus the input field after sending a message**
          focusInputField();
      } catch (error) {
          console.error(error);
          // Enable input and hide the loading indicator
          disableInput(false);
          setLoadingIndicator(false);
          displayMessage("assistant", "Error: Unable to get a response.");

          // **Focus the input field after an error occurs**
          focusInputField();
      }
  }

  // Helper functions to manage attachments
  function hasAttachments() {
      return messages.some(msg => msg.attachments && msg.attachments.length > 0);
  }

  function getAttachments() {
      return messages
          .filter(msg => msg.attachments && msg.attachments.length > 0)
          .map(msg => msg.attachments)
          .flat();
  }

  function clearAttachments() {
      messages = messages.map(msg => {
          if (msg.attachments) {
              return { ...msg, attachments: [] };
          }
          return msg;
      });
  }

  // Function to display attachment in the chat
  function displayAttachment(sender, attachment) {
      const chatBox = document.getElementById("chat-box");
      const attachmentDiv = document.createElement("div");
      attachmentDiv.className = 'message attachment';
      attachmentDiv.classList.add(sender === 'user' ? 'user-message' : 'assistant-message');

      const fileName = document.createElement('p');
      fileName.textContent = `Attachment: ${attachment.name}`;
      attachmentDiv.appendChild(fileName);

      // Display the attachment if it's an image
      if (attachment.type.startsWith('image/') && attachment.data) {
          const img = document.createElement('img');
          img.src = `data:${attachment.type};base64,${attachment.data}`; // Embed the Base64 image
          img.alt = attachment.name;
          img.style.maxWidth = '100%';
          attachmentDiv.appendChild(img);
      } else if (attachment.type.startsWith('application/pdf') && attachment.data) {
          // For PDFs, embed using <embed> or provide a link
          const embed = document.createElement('embed');
          embed.src = `data:${attachment.type};base64,${attachment.data}`;
          embed.type = attachment.type;
          embed.width = '100%';
          embed.height = '500px';
          attachmentDiv.appendChild(embed);
      } else if (attachment.data) {
          // For other file types, provide a download link
          const link = document.createElement('a');
          link.href = `data:${attachment.type};base64,${attachment.data}`;
          link.textContent = 'Download Attachment';
          link.download = attachment.name;
          attachmentDiv.appendChild(link);
      }

      chatBox.appendChild(attachmentDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
  }

  // Function to display text messages in the chat
  function displayMessage(sender, message) {
      const chatBox = document.getElementById("chat-box");
      const messageDiv = document.createElement("div");
      messageDiv.className = 'message';
      messageDiv.classList.add(sender === 'user' ? 'user-message' : 'assistant-message');
      messageDiv.textContent = message;
      chatBox.appendChild(messageDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
  }

  // Function to update session name from the first user message
  function updateSessionNameFromMessage(userMessage) {
      const activeSession = sessions.find(session => session.id === activeSessionId);
      if (activeSession) {
          let sessionName = userMessage.trim();
          if (sessionName.length > 20) {
              sessionName = sessionName.substring(0, 20) + '...';
          }
          activeSession.name = sessionName;

          // Save to localStorage
          localStorage.setItem('sessions', JSON.stringify(sessions));

          // Re-render the session list to reflect the updated name
          renderSessionList();
      }
  }

  // Function to update messages in the active session
  function updateSessionMessages() {
      const activeSession = sessions.find(session => session.id === activeSessionId);
      if (activeSession) {
          activeSession.messages = messages;

          // Save to localStorage
          localStorage.setItem('sessions', JSON.stringify(sessions));
      }
  }

  // Logout functionality
  document.getElementById("logout-btn").addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("sessions"); // Clear sessions
      localStorage.removeItem("activeSessionId");
      window.location.href = "login.html";
  });

  // New session button click event
  document.getElementById('new-session-btn').addEventListener('click', () => {
      createNewSession();
  });

  // Event listener for the form submission
  document.getElementById("message-form").addEventListener("submit", sendMessage);
});
