/**
 * Chunk dédié heic2any — import local pour que Vite/Rolldown
 * ne fusionne pas la lib dans vendor-misc (export dynamique cassé).
 */
import heic2any from 'heic2any';

export default heic2any;
