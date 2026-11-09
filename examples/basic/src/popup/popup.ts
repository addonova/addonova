import logoUrl from '../assets/logo.svg';
import { getMessage } from '../shared.ts';

const logo = document.getElementById('logo');
const message = document.getElementById('message');

if (logo instanceof HTMLImageElement) {
  logo.src = logoUrl;
}

if (message !== null) {
  message.textContent = getMessage();
}
