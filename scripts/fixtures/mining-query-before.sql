
        SELECT
          s.id,
          s.commodity,
          s.body,
          s.body_type,
          s.signal,
          s.latitude,
          s.longitude,
          s.rigs,
          s.preferred,
          s.notes,
          c.system_name,
          c.system_address,
          
          m.amount AS material_amount,
          m.updated_at AS material_updated_at,
          m.updated_by AS material_updated_by
        FROM mining_sites s
        LEFT JOIN mining_material_status m
          ON m.site_id = s.id
        LEFT JOIN mining_site_context c
          ON c.site_id = s.id
        WHERE NOT (
          s.latitude IS NULL
          AND s.longitude IS NULL
          AND EXISTS (
            SELECT 1
            FROM mining_sites resolved
            LEFT JOIN mining_site_context rc ON rc.site_id = resolved.id
            WHERE resolved.id <> s.id
              AND lower(resolved.commodity)=lower(s.commodity)
              AND lower(resolved.body)=lower(s.body)
              AND resolved.signal=s.signal
              AND resolved.latitude IS NOT NULL
              AND resolved.longitude IS NOT NULL
              AND lower(COALESCE(rc.system_name, ?))=lower(COALESCE(c.system_name, ?))
          )
        )
        ORDER BY
          s.commodity COLLATE NOCASE,
          s.body COLLATE NOCASE,
          s.signal,
          s.preferred DESC,
          s.rigs DESC
      