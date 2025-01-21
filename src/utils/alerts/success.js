// src/alerts/success.js
import Swal from 'sweetalert2';

export const showSuccessAlert = (title, text) => {
  Swal.fire({
    title: title || 'Success!',
    text: text || 'The action was successful.',
    icon: 'success',
    confirmButtonText: 'Cool',
  });
};