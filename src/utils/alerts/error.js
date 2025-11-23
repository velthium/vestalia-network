import Swal from 'sweetalert2';

export const showErrorAlert = (title, text, useHtml = false) => Swal.fire({ 
  title: title || 'Error!', 
  [useHtml ? 'html' : 'text']: text || 'Something went wrong.', 
  icon: 'error', 
  width: '50%', 
  confirmButtonText: 'Try Again', 
  customClass: { htmlContainer: 'lh-base' } 
});

export const showAccountEmptyAlert = (title, text) => Swal.fire({ title: title || 'Account empty', text: text || 'This wallet has no JACKAL (JKL). Please send some JKL tokens to your address before using the Vault.', icon: 'info', width: '520px', showCancelButton: true, showCloseButton: false, confirmButtonText: 'Go to Pricing', cancelButtonText: 'Return to homepage', allowOutsideClick: false, customClass: { htmlContainer: 'lh-base' } });