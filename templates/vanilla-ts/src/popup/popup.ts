const button = document.querySelector<HTMLButtonElement>('#ping');

button?.addEventListener('click', () => {
  console.log('ping from the Addonova popup');
});
