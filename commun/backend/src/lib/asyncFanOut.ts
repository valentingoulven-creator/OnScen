/**
 * Exécute `fn` sur chaque élément de `items` par lots, en rendant la main à la
 * boucle d'événements entre chaque lot (setImmediate). Utilisé pour les fan-out
 * de notifications (abonnés/favoris) qui peuvent porter sur des milliers de
 * destinataires : un simple `for` synchrone bloquerait le event loop (et donc
 * toutes les autres requêtes HTTP/sockets) pendant toute la durée du traitement.
 */
export function runInBatchesAsync<T>(items: readonly T[], fn: (item: T) => void, batchSize = 200): void {
  if (items.length === 0) return;
  let index = 0;
  const processBatch = () => {
    const end = Math.min(index + batchSize, items.length);
    for (; index < end; index++) {
      try {
        fn(items[index]);
      } catch (err) {
        console.error('[asyncFanOut] erreur traitement item:', err);
      }
    }
    if (index < items.length) {
      setImmediate(processBatch);
    }
  };
  setImmediate(processBatch);
}
