import { useCallback, useEffect, useState } from 'react';

/**
 * Small data-loading hook: runs `loader` on mount, whenever `deps` change, or
 * when `reload()` is called. Previous data stays visible while a reload runs.
 *
 * `loader` is deliberately not part of the dependency list — pages pass inline
 * arrows and describe the real inputs through `deps`.
 */
export function useAsyncData(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((problem) => {
        if (active) {
          setError(problem);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data, error, loading, reload };
}
