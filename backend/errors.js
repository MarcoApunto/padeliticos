// Error que arrastra el código HTTP con el que debe responder la API.
// Permite lanzar errores de validación sin perder el stack de JS.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}