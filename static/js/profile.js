/* ===========================================================
   profile.js — profile loading, follow/unfollow, edit profile,
   post grid.
   =========================================================== */

const VIEW_USER = document.body.dataset.viewUser;
let editProfileFile = null;

let hasLoadedOnce = false;

async function loadProfile() {
  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(VIEW_USER)}`);
    if (!res.ok) {
      document.getElementById('profileSkeleton').innerHTML =
        '<p style="color:var(--text-dim);">User not found.</p>';
      return;
    }
    const data = await res.json();
    renderProfile(data);
    hasLoadedOnce = true;
  } catch (e) {
    if (!hasLoadedOnce) showToast('Could not load profile');
  }
}

let pendingFollowPoll = null;

function followBtnHtml(data) {
  if (data.isSelf) {
    return `<button class="btn btn-ghost btn-sm" id="editProfileBtn">Edit profile</button>`;
  }
  if (data.followStatus === 'accepted') {
    return `<button class="btn btn-ghost btn-sm" id="followToggleBtn" data-following="true">Following</button>`;
  }
  if (data.followStatus === 'pending') {
    return `<button class="btn btn-ghost btn-sm" id="followToggleBtn" data-following="pending">Requested</button>`;
  }
  return `<button class="btn btn-primary btn-sm" id="followToggleBtn" data-following="false">Follow</button>`;
}

function manageFollowPoll(isPending) {
  clearInterval(pendingFollowPoll);
  pendingFollowPoll = null;
  if (isPending) {
    // While a request is awaiting approval, check periodically so this
    // private account's posts unlock as soon as they accept -- no manual
    // refresh needed.
    pendingFollowPoll = setInterval(async () => {
      const wasPending = true;
      await loadProfile();
      const nowBtn = document.getElementById('followToggleBtn');
      if (wasPending && nowBtn && nowBtn.dataset.following === 'true') {
        showToast(`@${VIEW_USER} accepted your follow request`);
      }
    }, 8000);
  }
}

function renderProfile(data) {
  document.getElementById('profileSkeleton').style.display = 'none';
  document.getElementById('profileContent').style.display = 'block';
  document.getElementById('profileTitle').textContent = data.username;
  document.getElementById('profileAvatar').src = `/uploads/${data.profilePic}`;
  document.getElementById('profileUsername').textContent = data.username;
  document.getElementById('profileActions').innerHTML = followBtnHtml(data);
  document.getElementById('statPosts').textContent = data.postCount;
  document.getElementById('statFollowers').textContent = data.followerCount;
  document.getElementById('statFollowing').textContent = data.followingCount;
  document.getElementById('profileBio').textContent = data.bio;

  manageFollowPoll(!data.isSelf && data.followStatus === 'pending');

  if (data.canViewPosts) {
    document.getElementById('profilePrivateMsg').style.display = 'none';
    const grid = document.getElementById('profileGrid');
    if (!data.posts.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <h3>No posts yet</h3>
      </div>`;
    } else {
      grid.innerHTML = data.posts.map(p => `
        <a class="grid-tile" href="#" data-post-id="${p.id}">
          <img src="/postimg/${p.image}" alt="" loading="lazy">
          <div class="grid-overlay">
            <span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${p.likeCount}</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>${p.commentCount}</span>
          </div>
        </a>
      `).join('');
    }
  } else {
    document.getElementById('profileGrid').innerHTML = '';
    document.getElementById('profilePrivateMsg').style.display = 'flex';
  }

  if (data.isSelf) {
    document.getElementById('editProfileBtn').addEventListener('click', () => {
      document.getElementById('editAvatarPreview').src = `/uploads/${data.profilePic}`;
      document.getElementById('editBioInput').value = data.bio;
      document.getElementById('editPrivateCheckbox').checked = data.isPrivate;
      openModal('editProfileModal');
    });
  } else {
    document.getElementById('followToggleBtn').addEventListener('click', handleFollowToggle);
  }
}

async function handleFollowToggle(e) {
  const btn = e.currentTarget;
  const state = btn.dataset.following;
  try {
    if (state === 'false') {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${encodeURIComponent(VIEW_USER)}`,
      });
      const data = await res.json();
      if (data.status === 'pending') {
        btn.textContent = 'Requested';
        btn.dataset.following = 'pending';
        btn.className = 'btn btn-ghost btn-sm';
      } else {
        btn.textContent = 'Following';
        btn.dataset.following = 'true';
        btn.className = 'btn btn-ghost btn-sm';
        loadProfile();
      }
    } else {
      await fetch('/api/unfollow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${encodeURIComponent(VIEW_USER)}`,
      });
      btn.textContent = 'Follow';
      btn.dataset.following = 'false';
      btn.className = 'btn btn-primary btn-sm';
      loadProfile();
    }
  } catch (err) {
    showToast('Could not update follow status');
  }
}

document.getElementById('editProfileFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  editProfileFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => { document.getElementById('editAvatarPreview').src = ev.target.result; };
  reader.readAsDataURL(file);
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const formData = new FormData();
  formData.append('bio', document.getElementById('editBioInput').value);
  formData.append('is_private', document.getElementById('editPrivateCheckbox').checked ? 'true' : 'false');
  if (editProfileFile) formData.append('profile', editProfileFile);

  try {
    await fetch('/api/profile/update', { method: 'POST', body: formData });
    closeModal('editProfileModal');
    showToast('Profile updated');
    editProfileFile = null;
    loadProfile();
  } catch (err) {
    showToast('Could not update profile');
  }
});

loadProfile();
