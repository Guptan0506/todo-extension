(function(){
  const STORAGE_KEY = 'simple-todo-v1';
  let tasks = [];
  let filter = 'all';

  function load(callback){
    try{
      chrome.storage.local.get([STORAGE_KEY], (result)=>{
        if(chrome.runtime.lastError){
          console.error('Could not load tasks', chrome.runtime.lastError);
        } else if(result && result[STORAGE_KEY]){
          tasks = result[STORAGE_KEY];
        }
        callback();
      });
    }catch(e){
      console.error('Could not load tasks', e);
      callback();
    }
  }

  function save(){
    try{
      chrome.storage.local.set({ [STORAGE_KEY]: tasks }, ()=>{
        if(chrome.runtime.lastError){
          console.error('Could not save tasks', chrome.runtime.lastError);
        }
      });
    }catch(e){ console.error('Could not save tasks', e); }
  }

  function formatDue(iso){
    // parse as local date to avoid timezone off-by-one
    const [y, m, d] = iso.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffDays = Math.round((due - today) / 86400000);

    const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    let text = label;
    if(diffDays === 0) text = 'Today';
    else if(diffDays === 1) text = 'Tomorrow';
    else if(diffDays === -1) text = 'Yesterday';

    return { text, overdue: diffDays < 0 };
  }

  function render(){
    const container = document.getElementById('list');
    const visible = tasks.filter(t=>{
      if(filter === 'active') return !t.done;
      if(filter === 'done') return t.done;
      return true;
    });

    while(container.firstChild){
      container.removeChild(container.firstChild);
    }

    if(visible.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = tasks.length === 0
        ? 'Nothing here yet. Add your first task above.'
        : 'Nothing in this view.';
      container.appendChild(empty);
    } else {
      visible.slice().reverse().forEach(t=>{
        if(!t.notes) t.notes = [];

        const item = document.createElement('div');
        item.className = 'item' + (t.done ? ' done' : '');

        const itemMain = document.createElement('div');
        itemMain.className = 'item-main';

        const checkbox = document.createElement('button');
        checkbox.className = 'checkbox' + (t.done ? ' checked' : '');
        checkbox.setAttribute('aria-label', 'Mark complete');
        itemMain.appendChild(checkbox);

        const textDiv = document.createElement('div');
        textDiv.className = 'text';
        textDiv.textContent = t.text;
        itemMain.appendChild(textDiv);

        const dueSlot = document.createElement('span');
        dueSlot.className = 'due-slot';
        itemMain.appendChild(dueSlot);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove';
        removeBtn.setAttribute('aria-label', 'Remove task');
        removeBtn.textContent = '✕';
        itemMain.appendChild(removeBtn);

        item.appendChild(itemMain);
        if(t.editingDue){
          const dateInput = document.createElement('input');
          dateInput.type = 'date';
          dateInput.className = 'due-edit';
          if(t.due) dateInput.value = t.due;

          const finishEdit = ()=>{
            t.due = dateInput.value || null;
            t.editingDue = false;
            save();
            render();
          };
          dateInput.addEventListener('change', finishEdit);
          dateInput.addEventListener('blur', finishEdit);
          dueSlot.appendChild(dateInput);
          setTimeout(()=>{ dateInput.focus(); }, 0);
        } else {
          const dueBtn = document.createElement('button');
          dueBtn.className = 'due';
          if(t.due){
            const { text, overdue } = formatDue(t.due);
            dueBtn.textContent = text;
            if(overdue && !t.done) dueBtn.classList.add('overdue');
          } else {
            dueBtn.textContent = '+ Date';
          }
          dueBtn.addEventListener('click', ()=>{
            t.editingDue = true;
            render();
          });
          dueSlot.appendChild(dueBtn);
        }

        item.querySelector('.checkbox').addEventListener('click', ()=>{
          t.done = !t.done;
          save();
          render();
        });
        item.querySelector('.remove').addEventListener('click', ()=>{
          tasks = tasks.filter(x=>x.id !== t.id);
          save();
          render();
        });

        if(t.notes.length > 0 && !t.editingNotes){
          const ul = document.createElement('ul');
          ul.className = 'notes';
          t.notes.forEach(line=>{
            const li = document.createElement('li');
            li.textContent = line;
            ul.appendChild(li);
          });
          item.appendChild(ul);

          const editBtn = document.createElement('button');
          editBtn.className = 'notes-toggle';
          editBtn.textContent = 'Edit details';
          editBtn.addEventListener('click', ()=>{
            t.editingNotes = true;
            render();
          });
          item.appendChild(editBtn);

        } else if(t.editingNotes){
          const textarea = document.createElement('textarea');
          textarea.className = 'notes-input';
          textarea.value = t.notes.join('\n');
          textarea.placeholder = 'One detail per line…';
          item.appendChild(textarea);

          const hint = document.createElement('div');
          hint.className = 'notes-hint';
          hint.textContent = 'Each line becomes a bullet point.';
          item.appendChild(hint);

          const doneBtn = document.createElement('button');
          doneBtn.className = 'notes-toggle';
          doneBtn.textContent = 'Save details';
          doneBtn.addEventListener('click', ()=>{
            t.notes = textarea.value.split('\n').map(l=>l.trim()).filter(l=>l.length > 0);
            t.editingNotes = false;
            save();
            render();
          });
          item.appendChild(doneBtn);

          setTimeout(()=>textarea.focus(), 0);

        } else {
          const addBtn = document.createElement('button');
          addBtn.className = 'notes-toggle';
          addBtn.textContent = '+ Add details';
          addBtn.addEventListener('click', ()=>{
            t.editingNotes = true;
            render();
          });
          item.appendChild(addBtn);
        }

        container.appendChild(item);
      });
    }

    const activeCount = tasks.filter(t=>!t.done).length;
    document.getElementById('countLabel').textContent =
      activeCount === 0 ? 'all done' : activeCount + ' left';
  }

  document.getElementById('addForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const input = document.getElementById('taskInput');
    const dueInput = document.getElementById('dueInput');
    const val = input.value.trim();
    if(!val) return;
    tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
      text: val,
      done: false,
      due: dueInput.value || null
    });
    input.value = '';
    dueInput.value = '';
    save();
    render();
  });

  document.querySelectorAll('.filters button[data-filter]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      filter = btn.dataset.filter;
      document.querySelectorAll('.filters button[data-filter]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  load(render);
})();
