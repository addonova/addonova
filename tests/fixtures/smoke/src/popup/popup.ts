import logoUrl from '../assets/logo.svg';

const logo = document.getElementById('logo');

if (logo instanceof HTMLImageElement) {
  logo.src = logoUrl;
}

document.body.dataset.ready = 'true';
