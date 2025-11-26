/* ============================================================
   EXAMS MODULE – QUẢN LÝ BỘ ĐỀ + AI + IMPORT PDF
   ============================================================ */
import { apiFetch } from '../../services/api.js';
import {
    fetchProblems,
    createProblem,
    deleteProblem,
    toggleProblemActive,
    aiGenerateTestcases,
    importPdfProblem
} from '../../services/problemService.js';

let generatedTestCases = [];      // dùng cho Create + Import
let pdfImportedProblems = [];
let currentEditingProblemId = null;

/* ============================================================
   INIT
   ============================================================ */
export function initExamsModule() {
    setupFilterListeners();
    setupTableListeners();
    setupCreateModal();
    setupImportModal();
    setupEditForm();  // Edit modal
}

/**
 * Hàm được gọi khi click tab "exams"
 */
export function loadExams() {
    fetchAndRenderExams();
}

/* ============================================================
   FETCH & RENDER
   ============================================================ */
async function fetchAndRenderExams() {
    const tableBody = document.getElementById('examTableBody');
    if (!tableBody) return;

    setLoadingRow(tableBody, 6);

    try {
        const exams = await fetchProblems();

        clearTableBody(tableBody);

        if (!exams || exams.length === 0) {
            setNoDataRow(tableBody, 6);
            return;
        }

        exams.forEach(exam => {
            const tr = document.createElement('tr');
            tr.dataset.id = exam.id;
            tr.dataset.difficulty = difficultyKey(exam.difficulty);

            // ID
            const tdId = document.createElement('td');
            tdId.dataset.label = 'ID';
            tdId.textContent = exam.id;

            // Title
            const tdTitle = document.createElement('td');
            tdTitle.dataset.label = 'Tên bộ đề';
            tdTitle.textContent = exam.title;

            // Difficulty
            const tdDiff = document.createElement('td');
            tdDiff.dataset.label = 'Độ khó';
            const badge = createDifficultyBadge(exam.difficulty);
            tdDiff.appendChild(badge);

            // Question Count (hiện tại 1 như file gốc)
            const tdCount = document.createElement('td');
            tdCount.dataset.label = 'Số câu hỏi';
            tdCount.textContent = '1';

            // Status
            const tdStatus = document.createElement('td');
            tdStatus.dataset.label = 'Trạng thái';
            const spanStatus = document.createElement('span');
            const isActive = !!exam.is_active;
            spanStatus.classList.add('status', isActive ? 'status-active' : 'status-locked');
            spanStatus.textContent = isActive ? 'Active' : 'Locked';
            tdStatus.appendChild(spanStatus);

            // Actions
            const tdActions = document.createElement('td');
            tdActions.dataset.label = 'Thao tác';
            tdActions.classList.add('actions-col');

            const btnEdit = document.createElement('button');
            btnEdit.classList.add('btn-edit');
            btnEdit.textContent = 'Edit';

            const btnLock = document.createElement('button');
            btnLock.classList.add('btn-lock', isActive ? 'active' : 'locked');
            btnLock.textContent = isActive ? 'Lock' : 'Unlock';

            const btnDelete = document.createElement('button');
            btnDelete.classList.add('btn-delete');
            btnDelete.textContent = 'Delete';

            tdActions.appendChild(btnEdit);
            tdActions.appendChild(btnLock);
            tdActions.appendChild(btnDelete);

            tr.appendChild(tdId);
            tr.appendChild(tdTitle);
            tr.appendChild(tdDiff);
            tr.appendChild(tdCount);
            tr.appendChild(tdStatus);
            tr.appendChild(tdActions);

            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error('Failed to fetch exams:', error);
        clearTableBody(tableBody);
        setErrorRow(tableBody, 6);
    }
}

/* ============================================================
   FILTER EXAMS
   ============================================================ */
function setupFilterListeners() {
    const levelFilter = document.getElementById('levelFilter');
    const tableBody = document.getElementById('examTableBody');
    if (!levelFilter || !tableBody) return;

    levelFilter.addEventListener('change', event => {
        const selected = event.target.value; // "" | "easy" | "medium" | "hard"
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const rowDiff = row.dataset.difficulty; // set trong fetchAndRenderExams
            if (!selected || !rowDiff) {
                row.style.display = '';
            } else {
                row.style.display = rowDiff === selected ? '' : 'none';
            }
        });
    });
}

/* ============================================================
   TABLE ACTIONS – DELETE / LOCK / EDIT
   ============================================================ */
function setupTableListeners() {
    const tableBody = document.getElementById('examTableBody');
    if (!tableBody) return;

    tableBody.addEventListener('click', async event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const row = target.closest('tr');
        if (!row) return;

        const examId = row.dataset.id;

        // DELETE
        if (target.classList.contains('btn-delete')) {
            if (!confirm('Bạn có chắc chắn muốn xóa bộ đề này không?')) return;
            try {
                await deleteProblem(examId);
                row.remove();
            } catch (error) {
                console.error('Lỗi khi xóa bộ đề:', error);
                alert('Không thể xóa bộ đề. Vui lòng thử lại.');
            }
            return;
        }

        // LOCK / UNLOCK
        if (target.classList.contains('btn-lock')) {
            const statusSpan = row.querySelector('.status');
            const isLocked = target.classList.contains('locked');
            const newActiveState = isLocked; // locked=true -> set is_active=true

            try {
                await toggleProblemActive(examId, newActiveState);

                if (newActiveState) {
                    // Active
                    statusSpan.textContent = 'Active';
                    statusSpan.className = 'status status-active';
                    target.textContent = 'Lock';
                    target.className = 'btn-lock active';
                } else {
                    // Locked
                    statusSpan.textContent = 'Locked';
                    statusSpan.className = 'status status-locked';
                    target.textContent = 'Unlock';
                    target.className = 'btn-lock locked';
                }
            } catch (error) {
                console.error('Lỗi khi cập nhật trạng thái:', error);
                alert('Không thể cập nhật trạng thái. Vui lòng thử lại.');
            }
            return;
        }

        // EDIT
        if (target.classList.contains('btn-edit')) {
            openEditModal(examId);
        }
    });
}

/* ============================================================
   CREATE PROBLEM MODAL + AI TESTCASES
   ============================================================ */
function setupCreateModal() {
    const createModal = document.getElementById('createProblemModal');
    const openCreateBtn = document.getElementById('showCreateModalBtn');
    const closeCreateBtn = document.getElementById('closeCreateModalBtn');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const createForm = document.getElementById('createProblemForm');
    const aiBtn = document.getElementById('generateTestcaseBtn');
    const previewArea = document.getElementById('testcasePreviewArea');

    const titleEl = document.getElementById('problemTitle');
    const descEl = document.getElementById('problemDescription');
    const diffEl = document.getElementById('problemDifficultyDisplay');
    const timeEl = document.getElementById('problemTimeLimit');
    const memEl = document.getElementById('problemMemoryLimit');

    if (!createModal || !openCreateBtn || !createForm) return;

    const resetCreateModal = () => {
        createForm.reset();
        generatedTestCases = [];

        if (previewArea) {
            previewArea.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = 'Chưa có test case nào...';
            previewArea.appendChild(p);
        }
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.textContent = 'Tạo Test Case bằng AI';
        }
        if (diffEl) {
            diffEl.textContent =
                'Sẽ được AI tự đánh giá sau khi bạn tạo Test Case';
            diffEl.dataset.value = '';
        }

        const submitBtn = createForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Lưu Bộ đề';
        }
    };

    const openModal = () => {
        resetCreateModal();
        createModal.style.display = 'block';
    };

    const closeModal = () => {
        createModal.style.display = 'none';
    };

    openCreateBtn.addEventListener('click', openModal);
    if (closeCreateBtn) closeCreateBtn.addEventListener('click', closeModal);
    if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', closeModal);

    createModal.addEventListener('click', e => {
        if (e.target === createModal) closeModal();
    });

    // AI generate testcases
    if (aiBtn && descEl && previewArea && diffEl) {
        aiBtn.addEventListener('click', async () => {
            const description = descEl.value;
            if (!description.trim()) {
                alert('Vui lòng nhập mô tả bài toán trước khi tạo test case.');
                return;
            }

            aiBtn.disabled = true;
            aiBtn.textContent = 'Đang tạo...';

            // clear preview
            previewArea.innerHTML = '';
            const loadingP = document.createElement('p');
            loadingP.textContent = 'Đang liên hệ với AI, vui lòng chờ...';
            previewArea.appendChild(loadingP);

            try {
                const response = await aiGenerateTestcases(description);

                // Độ khó AI trả về
                if (response.difficulty) {
                    const mapVN = {
                        easy: 'Dễ',
                        medium: 'Trung bình',
                        hard: 'Khó',
                        very_hard: 'Rất khó',
                        extreme: 'Cực khó'
                    };

                    diffEl.textContent =
                        mapVN[response.difficulty] || 'Không xác định';
                    diffEl.dataset.value = response.difficulty;
                }

                if (!response.test_cases || response.test_cases.length === 0) {
                    throw new Error('AI không trả về test case nào.');
                }

                // Map testcases AI (input/output) -> (input_data/expected_output/is_hidden)
                generatedTestCases = response.test_cases.map(tc => ({
                    input_data: tc.input ?? '',
                    expected_output: tc.output ?? '',
                    is_hidden: tc.is_hidden ?? true
                }));

                renderTestcasePreview(previewArea, generatedTestCases);
            } catch (error) {
                console.error('Lỗi khi tạo test case bằng AI:', error);
                previewArea.innerHTML = '';
                const p = document.createElement('p');
                p.style.color = 'red';
                p.textContent = `Lỗi: ${error.message}`;
                previewArea.appendChild(p);
                generatedTestCases = [];
            } finally {
                aiBtn.disabled = false;
                aiBtn.textContent = 'Tạo Test Case bằng AI';
            }
        });
    }

    // Submit create problem
    createForm.addEventListener('submit', async e => {
        e.preventDefault();

        if (generatedTestCases.length === 0) {
            if (!confirm('Chưa có test case nào. Bạn vẫn muốn lưu bộ đề này?')) {
                return;
            }
        }

        const submitBtn = createForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang lưu...';
        }

        const mapToInt = {
            easy: 1,
            medium: 2,
            hard: 3,
            very_hard: 4,
            extreme: 5
        };

        const difficultyValue = diffEl?.dataset?.value
            ? mapToInt[diffEl.dataset.value] || 2
            : 2;

        const problemData = {
            title: titleEl.value,
            description: descEl.value,
            difficulty: difficultyValue,
            time_limit: parseInt(timeEl.value, 10),
            memory_limit: parseInt(memEl.value, 10),
            // BACKEND expect: [{input_data, expected_output, is_hidden}]
            test_cases: generatedTestCases
        };

        try {
            await createProblem(problemData);
            closeModal();
            fetchAndRenderExams();
        } catch (error) {
            console.error('Lỗi khi lưu bộ đề:', error);
            alert(`Không thể lưu bộ đề: ${error.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Lưu Bộ đề';
            }
        }
    });
}

/* ============================================================
   IMPORT PDF MODAL
   ============================================================ */
function setupImportModal() {
    const importModal = document.getElementById('importProblemModal');
    const showImportBtn = document.getElementById('showImportModalBtn');
    const closeImportBtn = document.getElementById('closeImportModalBtn');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const uploadPdfBtn = document.getElementById('uploadPdfBtn');
    const saveImportedBtn = document.getElementById('saveImportedProblemBtn');
    const importFileInput = document.getElementById('importPdfFile');
    const importResultArea = document.getElementById('importResultArea');

    if (!importModal || !showImportBtn) return;

    const openModal = () => {
        pdfImportedProblems = [];
        if (importResultArea) {
            importResultArea.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = 'Chưa có dữ liệu...';
            importResultArea.appendChild(p);
        }
        if (saveImportedBtn) {
            saveImportedBtn.disabled = true;
        }
        importModal.style.display = 'block';
    };

    const closeModal = () => {
        importModal.style.display = 'none';
    };

    showImportBtn.addEventListener('click', openModal);
    if (closeImportBtn) closeImportBtn.addEventListener('click', closeModal);
    if (cancelImportBtn) cancelImportBtn.addEventListener('click', closeModal);

    importModal.addEventListener('click', e => {
        if (e.target === importModal) closeModal();
    });

    // Upload PDF & gọi AI
    if (uploadPdfBtn && importFileInput && importResultArea) {
        uploadPdfBtn.addEventListener('click', async () => {
            if (!importFileInput.files.length) {
                alert('Vui lòng chọn file PDF.');
                return;
            }

            const file = importFileInput.files[0];

            importResultArea.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = 'Đang phân tích PDF bằng AI...';
            importResultArea.appendChild(p);

            uploadPdfBtn.disabled = true;

            try {
                const data = await importPdfProblem(file);
                const problems = data.problems || [];

                if (!problems.length) {
                    importResultArea.innerHTML = '';
                    const p2 = document.createElement('p');
                    p2.style.color = 'red';
                    p2.textContent = 'Không tìm thấy bài toán nào trong PDF.';
                    importResultArea.appendChild(p2);
                    pdfImportedProblems = [];
                    if (saveImportedBtn) saveImportedBtn.disabled = true;
                    return;
                }

                pdfImportedProblems = problems;

                renderImportedProblems(importResultArea, problems);

                if (saveImportedBtn) {
                    saveImportedBtn.disabled = false;
                }

                // Fill bài đầu tiên lên form Create Problem (nếu muốn)
                const first = problems[0];
                fillFirstProblemToCreateForm(first);
            } catch (error) {
                console.error('Lỗi phân tích PDF:', error);
                importResultArea.innerHTML = '';
                const pErr = document.createElement('p');
                pErr.style.color = 'red';
                pErr.textContent = error.message;
                importResultArea.appendChild(pErr);
                pdfImportedProblems = [];
                if (saveImportedBtn) saveImportedBtn.disabled = true;
            } finally {
                uploadPdfBtn.disabled = false;
            }
        });
    }

    // Save imported problems
    if (saveImportedBtn) {
        saveImportedBtn.addEventListener('click', async () => {
            if (!pdfImportedProblems || pdfImportedProblems.length === 0) {
                alert('Không có bài toán nào để lưu. Vui lòng import PDF trước.');
                return;
            }

            saveImportedBtn.disabled = true;
            saveImportedBtn.textContent = 'Đang lưu tất cả...';

            let successCount = 0;
            let failCount = 0;

            const difficultyMap = {
                easy: 1,
                medium: 2,
                hard: 3,
                very_hard: 4,
                extreme: 5
            };

            for (const p of pdfImportedProblems) {
                // Map testcases từ AI/import (input/output) sang input_data/expected_output
                const mappedTestCases = (p.test_cases || []).map(tc => ({
                    input_data: tc.input ?? '',
                    expected_output: tc.output ?? '',
                    is_hidden: tc.is_hidden ?? true
                }));

                const payload = {
                    title: p.title,
                    description: p.description,
                    time_limit: 1000,
                    memory_limit: 256,
                    test_cases: mappedTestCases,
                    difficulty: difficultyMap[p.difficulty] || 2
                };

                try {
                    await createProblem(payload);
                    successCount++;
                } catch (error) {
                    console.error('Lỗi khi lưu bài:', p.title, error);
                    failCount++;
                }
            }

            alert(
                `Hoàn tất lưu bộ đề từ PDF.\nThành công: ${successCount}\nThất bại: ${failCount}`
            );

            saveImportedBtn.disabled = false;
            saveImportedBtn.textContent = 'Lưu thành Bộ đề';

            closeModal();
            fetchAndRenderExams();
        });
    }
}

/* ============================================================
   RENDER HELPERS
   ============================================================ */
function renderTestcasePreview(container, testcases) {
    container.innerHTML = '';

    testcases.forEach((tc, index) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('testcase-item');
        wrapper.style.borderBottom = '1px solid #eee';
        wrapper.style.paddingBottom = '5px';
        wrapper.style.marginBottom = '5px';

        const title = document.createElement('strong');
        title.textContent = `Test Case ${index + 1} ${
            tc.is_hidden ? '(Hidden)' : '(Sample)'
        }`;
        wrapper.appendChild(title);

        // Hỗ trợ cả dạng input/output và input_data/expected_output
        const inputVal =
            tc.input_data ?? tc.input ?? '';
        const outputVal =
            tc.expected_output ?? tc.output ?? '';

        const pInput = document.createElement('p');
        pInput.style.margin = '0';
        pInput.style.fontFamily = 'monospace';
        pInput.style.background = '#fafafa';
        pInput.style.padding = '2px 5px';
        pInput.innerHTML =
            '<strong>Input:</strong> ' +
            String(inputVal || '')
                .replace(/\n/g, '<br>')
                .trim();
        wrapper.appendChild(pInput);

        const pOutput = document.createElement('p');
        pOutput.style.margin = '0';
        pOutput.style.fontFamily = 'monospace';
        pOutput.style.background = '#fafafa';
        pOutput.style.padding = '2px 5px';
        pOutput.innerHTML =
            '<strong>Output:</strong> ' +
            String(outputVal || '')
                .replace(/\n/g, '<br>')
                .trim();
        wrapper.appendChild(pOutput);

        container.appendChild(wrapper);
    });
}

function renderImportedProblems(container, problems) {
    container.innerHTML = '';

    problems.forEach((p, index) => {
        const item = document.createElement('div');
        item.classList.add('imported-problem-item');
        item.style.borderBottom = '1px solid #eee';
        item.style.padding = '8px 0';
        item.style.marginBottom = '8px';

        const h4 = document.createElement('h4');
        h4.textContent = `Bài ${index + 1}: ${p.title}`;
        item.appendChild(h4);

        const diffP = document.createElement('p');
        const diffDisplay = mapDifficultyVN(p.difficulty);
        diffP.innerHTML = `<strong>Độ khó (AI đánh giá):</strong> ${diffDisplay}`;
        item.appendChild(diffP);

        const h5Desc = document.createElement('h5');
        h5Desc.textContent = 'Mô tả bài toán';
        item.appendChild(h5Desc);

        const preDesc = document.createElement('pre');
        preDesc.textContent = p.description || '';
        item.appendChild(preDesc);

        const h5Ts = document.createElement('h5');
        h5Ts.textContent = 'Testcases';
        item.appendChild(h5Ts);

        const preTs = document.createElement('pre');
        preTs.textContent = JSON.stringify(p.test_cases || [], null, 2);
        item.appendChild(preTs);

        container.appendChild(item);
    });
}

function fillFirstProblemToCreateForm(first) {
    if (!first) return;

    const titleEl = document.getElementById('problemTitle');
    const descEl = document.getElementById('problemDescription');
    const diffEl = document.getElementById('problemDifficultyDisplay');
    const previewArea = document.getElementById('testcasePreviewArea');

    if (titleEl) titleEl.value = first.title || '';
    if (descEl) descEl.value = first.description || '';
    if (diffEl) {
        diffEl.dataset.value = first.difficulty || '';
        diffEl.textContent = mapDifficultyVN(first.difficulty);
    }

    if (previewArea && first.test_cases) {
        // Map testcases import PDF -> dạng chuẩn
        generatedTestCases = first.test_cases.map(tc => ({
            input_data: tc.input ?? '',
            expected_output: tc.output ?? '',
            is_hidden: tc.is_hidden ?? true
        }));
        renderTestcasePreview(previewArea, generatedTestCases);
    }
}

/* ============================================================
   DIFFICULTY HELPERS
   ============================================================ */
function difficultyKey(level) {
    if (level === 1) return 'easy';
    if (level === 2) return 'medium';
    if (level === 3) return 'hard';
    if (level === 4) return 'very_hard';
    if (level === 5) return 'extreme';
    return 'unknown';
}

function mapDifficultyVN(key) {
    const mapVN = {
        easy: 'Dễ',
        medium: 'Trung bình',
        hard: 'Khó',
        very_hard: 'Rất khó',
        extreme: 'Cực khó'
    };
    return mapVN[key] || key || 'Không rõ';
}

function createDifficultyBadge(level) {
    const key = difficultyKey(level);

    const classes = {
        easy: 'badge-easy',
        medium: 'badge-medium',
        hard: 'badge-hard',
        very_hard: 'badge-very-hard',
        extreme: 'badge-extreme',
        unknown: 'badge-unknown'
    };

    const span = document.createElement('span');
    span.classList.add('badge', classes[key] || classes.unknown);
    span.textContent = mapDifficultyVN(key);
    return span;
}

/* ============================================================
   TABLE HELPERS
   ============================================================ */
function clearTableBody(tbody) {
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
}

function setLoadingRow(tbody, colSpan) {
    clearTableBody(tbody);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.style.textAlign = 'center';
    td.style.padding = '1rem';
    td.textContent = 'Đang tải...';
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function setNoDataRow(tbody, colSpan) {
    clearTableBody(tbody);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.style.textAlign = 'center';
    td.style.padding = '1rem';
    td.textContent = 'Không có dữ liệu.';
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function setErrorRow(tbody, colSpan) {
    clearTableBody(tbody);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.style.textAlign = 'center';
    td.style.padding = '1rem';
    td.style.color = 'red';
    td.textContent = 'Lỗi khi tải dữ liệu!';
    tr.appendChild(td);
    tbody.appendChild(tr);
}

/* ============================================================
   EDIT MODAL HELPERS
   ============================================================ */
function renderEditTestcases(testcases) {
    const list = document.getElementById('editTestcaseList');
    if (!list) return;
    list.innerHTML = '';

    (testcases || []).forEach((tc, index) => {
        const item = document.createElement('div');
        item.classList.add('edit-tc-item');

        const inputVal = tc.input_data ?? tc.input ?? '';
        const outputVal = tc.expected_output ?? tc.output ?? '';
        const isHidden = tc.is_hidden ?? true;

        item.innerHTML = `
            <label>Test Case ${index + 1}</label>
            <textarea class="edit-tc-input" rows="2">${inputVal}</textarea>
            <textarea class="edit-tc-output" rows="2">${outputVal}</textarea>

            <label>
                <input type="checkbox" class="edit-tc-hidden" ${isHidden ? 'checked' : ''}>
                Hidden
            </label>

            <button type="button" class="btn-delete-tc">X</button>
            <hr>
        `;

        // Xóa test case
        item.querySelector('.btn-delete-tc').addEventListener('click', () => {
            item.remove();
        });

        list.appendChild(item);
    });
}

function addEmptyEditTestcaseRow() {
    const list = document.getElementById('editTestcaseList');
    if (!list) return;

    const item = document.createElement('div');
    item.classList.add('edit-tc-item');

    item.innerHTML = `
        <label>Test Case mới</label>
        <textarea class="edit-tc-input" rows="2"></textarea>
        <textarea class="edit-tc-output" rows="2"></textarea>

        <label>
            <input type="checkbox" class="edit-tc-hidden">
            Hidden
        </label>

        <button type="button" class="btn-delete-tc">X</button>
        <hr>
    `;

    item.querySelector('.btn-delete-tc').addEventListener('click', () => {
        item.remove();
    });

    list.appendChild(item);
}

function collectEditTestcases() {
    const list = document.getElementById('editTestcaseList');
    if (!list) return [];

    const items = list.querySelectorAll('.edit-tc-item');
    const result = [];

    items.forEach(item => {
        const input = item.querySelector('.edit-tc-input').value.trim();
        const output = item.querySelector('.edit-tc-output').value.trim();
        const isHidden = item.querySelector('.edit-tc-hidden').checked;

        result.push({
            // backend expect keys này
            input_data: input,
            expected_output: output,
            is_hidden: isHidden
        });
    });

    return result;
}

/* ============================================================
   EDIT FORM SETUP
   ============================================================ */
function setupEditForm() {
    const form = document.getElementById('editProblemForm');
    const modal = document.getElementById('editProblemModal');
    const closeBtn = document.getElementById('closeEditModalBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    const addTcBtn = document.getElementById('addTestcaseBtn');

    if (!form || !modal) return;

    // Submit update
    form.addEventListener('submit', async e => {
        e.preventDefault();

        const tcs = collectEditTestcases();

        const payload = {
            title: document.getElementById('editProblemTitle').value,
            description: document.getElementById('editProblemDescription').value,
            difficulty: parseInt(document.getElementById('editProblemDifficulty').value),
            time_limit: parseInt(document.getElementById('editProblemTimeLimit').value),
            memory_limit: parseInt(document.getElementById('editProblemMemoryLimit').value),
            test_cases: tcs
        };

        try {
            await apiFetch(`/api/problems/${currentEditingProblemId}/`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            alert('Cập nhật thành công!');
            modal.style.display = 'none';
            fetchAndRenderExams();
        } catch (err) {
            alert('Lỗi cập nhật bộ đề!');
            console.error(err);
        }
    });

    const closeModal = () => {
        modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    if (addTcBtn) {
        addTcBtn.addEventListener('click', () => {
            addEmptyEditTestcaseRow();
        });
    }
}

/* ============================================================
   OPEN EDIT MODAL
   ============================================================ */
async function openEditModal(problemId) {
    currentEditingProblemId = problemId;

    const modal = document.getElementById("editProblemModal");
    modal.style.display = "block";

    try {
        const problem = await apiFetch(`/api/problems/${problemId}/`);

        document.getElementById("editProblemTitle").value = problem.title;
        document.getElementById("editProblemDescription").value = problem.description;
        document.getElementById("editProblemDifficulty").value = problem.difficulty;
        document.getElementById("editProblemTimeLimit").value = problem.time_limit;
        document.getElementById("editProblemMemoryLimit").value = problem.memory_limit;

        renderEditTestcases(problem.test_cases);

    } catch (err) {
        console.error("Lỗi khi load chi tiết bộ đề:", err);
        alert("Không thể tải thông tin bộ đề để chỉnh sửa.");
    }
}

