function createPrompt() {
  return new Promise((resolve, reject) => {
    // Create elements for the prompt dialog
    const overlay = document.createElement('div');
    overlay.className = 'prompt-overlay';

    const container = document.createElement('div');
    container.className = 'prompt-container';

    const input = document.createElement('input');
    input.className = 'prompt-input';
    input.type = 'text';

    const buttons = document.createElement('div');
    buttons.className = 'prompt-buttons';

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.addEventListener('click', () => {
      const value = input.value;
      resolve(value);
      document.body.removeChild(overlay);
    });

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      resolve(null);
      document.body.removeChild(overlay);
    });

    // Assemble the prompt dialog
    buttons.appendChild(okButton);
    buttons.appendChild(cancelButton);

    container.appendChild(input);
    container.appendChild(buttons);

    overlay.appendChild(container);

    document.body.appendChild(overlay);

    // Set focus to the input field
    input.focus();
  });
}
export { createPrompt };