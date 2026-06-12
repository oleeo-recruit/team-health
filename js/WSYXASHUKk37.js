jQuery(document).ready(function ($) {

    /* ===============================
     * Select2 Init
     * =============================== */
    $('.fja-select2').each(function() {
        $(this).select2({
            width: '100%',
            allowClear: true,
            closeOnSelect: true,
            placeholder: $(this).data('placeholder')
        });
    });

    // Accessibility: label Select2 generated combobox and search input elements
    $('.fja-job-filters .fja-select2').each(function() {
        const id = $(this).attr('id');
        const labelText = $('label[for="' + id + '"]').text().trim() ||
                          $(this).data('placeholder') ||
                          id;

        const $container = $(this).next('.select2-container');
        $container.find('.select2-selection').attr('aria-label', labelText);
        $container.find('.select2-search__field').attr('aria-label', 'Search ' + labelText);
    });

    const wrapper = $('.fja-jobs-wrapper');
    if (!wrapper.length) return;

    const results    = wrapper.find('.fja-job-results');
    const pagination = wrapper.find('.fja-pagination');
    const perPage    = wrapper.data('per-page');

    console.log(FJA);

    /* ===============================
     * Refresh Facets
     * =============================== */
    function refreshFacets() {
        const data = { action: 'fja_get_facets' };

        wrapper.find('select').each(function () {
            const name = $(this).attr('name').replace('[]', '');
            const val  = $(this).val();
            if (val && val.length) data[name] = val;
        });

        const keyword = wrapper.find('#keyword').val();
        if (keyword && keyword.trim()) data.keyword = keyword.trim();

        // ✅ Pass fja_ids to facets so counts are also scoped
        const urlParams = new URLSearchParams(window.location.search);
        const fjaIds = urlParams.get('fja_ids');
        if (fjaIds) data.fja_ids = fjaIds;

        $.post(FJA.ajax, data, function (res) {
            if (!res.success) return;

            Object.keys(res.data.facets).forEach(function (tax) {
                const $sel = wrapper.find('select[name="' + tax + '"], select[name="' + tax + '[]"]');
                if (!$sel.length) return;

                const selected = $sel.val() || [];
                $sel.find('option').not('[value=""]').remove();

                console.log(res.data.facets);

                res.data.facets[tax].forEach(function (item) {
                    const label = `${item.name} (${item.count})`;
                    const opt   = new Option(label, item.slug, false, selected.includes(item.slug));

                    if (item.count === 0 && !selected.includes(item.slug)) {
                        opt.disabled = true;
                    }

                    $sel.append(opt);
                });

                $sel.trigger('change.select2');
            });
        });
    }

    /* ===============================
     * Fetch Jobs
     * =============================== */
    function fetchJobs(page = 1, ignoreIds = false) {

        const data = {
            action:   'fja_fetch_jobs',
            page:     page,
            per_page: perPage
        };

        /* Collect filters */
        wrapper.find('select').each(function () {
            const name     = $(this).attr('name');
            const val      = $(this).val();
            const cleanName = name.replace('[]', '');

            if (!val || val.length === 0) return;

            data[cleanName] = val;
        });

       if (!ignoreIds) {
            const urlParams = new URLSearchParams(window.location.search);
            const fjaIds    = urlParams.get('fja_ids');
            if (fjaIds) {
                data.fja_ids = fjaIds;
            }
        }

        console.log(data);

        const keyword = wrapper.find('#keyword').val();
        if (keyword && keyword.trim().length) {
            data.keyword = keyword.trim();
        }

        updateURL({
            page:     page,
            keyword:  $('#keyword').val(),
            distance: $('#distance').val(),
            job_city: $('#job_city').val(),
            ...data
        }, ignoreIds);

        /* Before AJAX */
        results.addClass('loading');
        $('.fja-loader').show();
        wrapper.find('button[type="submit"]').prop('disabled', true);

        $.post(FJA.ajax, data, function (res) {

            if (!res.success) {
                wrapper.find('button[type="submit"]').prop('disabled', false);
                return;
            }

            $('.fja-loader').hide();
            results.removeClass('loading');
            results.html(res.data.html);
            renderPagination(res.data.pages, page);
            wrapper.find('button[type="submit"]').prop('disabled', false);
        });
    }

    /* ===============================
     * Update Browser URL
     * =============================== */
    function updateURL(data, ignoreIds = false) {
        const params = new URLSearchParams();
		
           // ✅ Only preserve fja_ids if not a fresh search
            if (!ignoreIds) {
                const currentParams = new URLSearchParams(window.location.search);
                const fjaIds = currentParams.get('fja_ids');
                if (fjaIds) {
                    params.set('fja_ids', fjaIds);
                }
            }
		
			  // ✅ Always preserve UTM parameters
			const utm_Params = new URLSearchParams(window.location.search);
			utm_Params.forEach(function (val, key) {
				if (key.startsWith('utm_')) {					
					params.set(key, val);
				}
			});
		console.log(utm_Params);


        Object.keys(data).forEach(key => {
            if (!data[key]) return;

            if (Array.isArray(data[key])) {
                data[key].forEach(val => params.append(key + '[]', val));
            } else {
                params.set(key, data[key]);
            }
        });

        const newURL = window.location.pathname + '?' + params.toString();
        window.history.pushState({}, '', newURL);
    }

    /* ===============================
     * Apply Filters From URL on Load
     * =============================== */
    function applyFiltersFromURL() {
        const params = new URLSearchParams(window.location.search);
// 	  // ✅ Always preserve UTM parameters
// 				params.forEach(function (val, key) {
// 					if (key.startsWith('utm_')) {
// 						params.set(key, val);
// 					}
// 				});
// 		console.log(params);
		
        $('.fja-select2').each(function () {
            const name = $(this).attr('name');
            if (!name) return;

            const values = params.getAll(name) || params.getAll(name + '[]');
            if (values.length) {
                $(this).val(values).trigger('change.select2');
            }
        });

        const keyword = params.get('keyword');
        if (keyword) {
            $('#keyword').val(keyword);
        }
    }

    /* ===============================
     * Render Pagination
     * =============================== */
    function renderPagination(totalPages, currentPage) {

        if (totalPages <= 1) {
            pagination.html('');
            return;
        }

        const maxVisible = 5;
        let html = '';

        const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end   = Math.min(totalPages, start + maxVisible - 1);

        if (currentPage > 1) {
            html += `<a href="#" data-page="1" class="fja-page first">« First</a>`;
            html += `<a href="#" data-page="${currentPage - 1}" class="fja-page prev">‹ Prev</a>`;
        }

        if (start > 1) {
            html += `<span class="fja-ellipsis">…</span>`;
        }

        for (let i = start; i <= end; i++) {
            html += `<a href="#" data-page="${i}" class="fja-page ${i === currentPage ? 'active' : ''}">${i}</a>`;
        }

        if (end < totalPages) {
            html += `<span class="fja-ellipsis">…</span>`;
        }

        if (currentPage < totalPages) {
            html += `<a href="#" data-page="${currentPage + 1}" class="fja-page next">Next ›</a>`;
            html += `<a href="#" data-page="${totalPages}" class="fja-page last">Last »</a>`;
        }

        pagination.html(html);
    }

    /* ===============================
     * Event Listeners
     * =============================== */
    wrapper.on('change', 'select, #keyword', function () {
        refreshFacets();
    });

    wrapper.on('submit', '.fja-job-filters', function (e) {
        e.preventDefault();
        fetchJobs(1,true);
    });

    wrapper.on('click', '.fja-job-filter-button', function (e) {
        e.preventDefault();
        fetchJobs(1, true);
    });

    wrapper.on('click', '.fja-pagination a', function (e) {
        e.preventDefault();
        fetchJobs($(this).data('page'));
    });

    wrapper.on('click', '.mt-custom-jobs-row', function (e) {
        if ($(e.target).closest('a').length) return;
        const url = $(this).data('link');
        if (url) window.location.href = url;
    });

    /* ===============================
     * Initial Load
     * =============================== */
    applyFiltersFromURL();
    const initialPage = parseInt(new URLSearchParams(window.location.search).get('page')) || 1;
    fetchJobs(initialPage);
    wrapper.find('select').trigger('change');

});