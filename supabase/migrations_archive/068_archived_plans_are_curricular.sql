-- Los planes archivados que SÍ son estudios reales del currículo deben ser
-- is_curricular=true (se crearon en false por error). Siguen ocultos de
-- matrícula/análisis por is_active=false; el currículo los muestra marcados como
-- desactivados. "¿Adónde va este bus?" (BUS) sigue is_curricular=false (charla
-- introductoria, no es estudio del plan).
update study_plans set is_curricular = true
where code in ('PLANDANIEL', 'TEOAT', 'LECTPROP', 'PAREJAS', 'QEJ');
