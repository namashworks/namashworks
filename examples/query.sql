SELECT backend,
       ROUND(AVG(fidelity), 3) AS mean_fidelity,
       COUNT(fidelity)         AS scored,
       COUNT(*)                AS runs
FROM   experiment_runs
WHERE  circuit = 'ghz_8q'
GROUP BY backend
ORDER BY mean_fidelity DESC;
