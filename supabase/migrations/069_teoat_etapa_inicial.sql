-- Teología del AT (Esepa) es de etapa inicial, no la categoría 'externa'.
-- (Se mantiene is_active=false / archivado; aparece en Etapa Inicial marcado inactivo.)
update study_plans set level = 'etapa_inicial' where code = 'TEOAT';
