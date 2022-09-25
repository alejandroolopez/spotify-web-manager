(function() {

  window.u={
    user_id: null,
    playlists: [],
    selection: [],
    moving_mode: false
  };

  /**
   * Obtains parameters from the hash of the URL
   * @return Object
   */
  function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while ( e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    console.log(hashParams);
    return hashParams;
  }

  function request(link, type, callback){
    $.ajax({
      url: link,
      type: type,
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      success: callback,
      error: (xhr,status,error) => console.log(xhr.responseJSON.error)
    });
  };

  /**
   * 
   * @param String with url
   * @param String with HTTP method
   * @returns Object with the result
   */
  async function HttpRequest(url, type) {
    return new Promise ((resolve, reject) => {
      var req = new XMLHttpRequest();
      req.open(type, url);
      req.setRequestHeader('Content-Type', 'application/json');
      req.setRequestHeader('Authorization', `Bearer ${access_token}`);

      req.onload = () => {
        if(this.status >= 200 || this.status < 300) resolve(JSON.parse(req.response));
        else reject({
          error: "reject",
          status: this.status,
          statusText: req.statusText
        });
      };

      req.onerror = () => reject({
        error: "error",
        status: this.status,
        statusText: req.statusText
      });

      req.send();
    });
  };

  var params = getHashParams();

  var access_token = params.access_token,
      refresh_token = params.refresh_token,
      error = params.error;

  if (error || !access_token) window.location.href="/authorize";
  else request('https://api.spotify.com/v1/me', "GET", res => u.userId=res.id);

  /**
     * Make HTTP requests with HttpRequest() to
     * obtain all the playlists of user async call savePlaylists()
     * 
     * @return Array of all playlists objects
     */
  async function getPlaylists() {
    var playlists = [];
    var res = await HttpRequest('https://api.spotify.com/v1/me/playlists?limit=50', "GET");
    playlists.push(...res.items);
    while (res.next !== null) {
      res = await HttpRequest(res.next, "GET");
      playlists.push(...res.items);
    }
    return playlists;
  };

  /**
   * With gived array of playlists objects,
   * saves only playlists that are created
   * by the user into global variable.
   * 
   * @param Array of playlists objects
   */
  function savePlaylists(playlists) {
    for (const item of playlists) {
      if (item.owner.id != u.userId) continue;
      item["songs"] = [];
      u.playlists[item.id] = item;
    };
  };

  /**
   * Insert into nav div all the playlists
   */
  function showPlaylists() {
    for (const i in u.playlists) {
      var html = `<div class="playlist" id="${u.playlists[i].id}"><h3>${u.playlists[i].name}</h3></div>`;
      $("#playlists").append(html);
    }
  };

  /**
   * Make HttpRequest() of all the songs
   * of the playlist id passed
   * 
   * @param String with the playlist id 
   * @returns Array of Objects of songs
   */
  async function getSongsOfPlaylist(playlist_id) {
    var songs = [];
    var res = await HttpRequest(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks?limit=50`, "GET");
    songs.push(...res.items);
    while (res.next !== null) {
      res = await HttpRequest(res.next, "GET");
      songs.push(...res.items);
    }
    return songs;
  };

  /**
   * Save into global variable the songs
   * 
   * @param String of the playlist id 
   * @param Array of object songs 
   */
  function saveSongs(playlist_id, songs) {
    u.playlists[playlist_id].songs.push(...songs);
  };

  /**
   * Insert into div all the songs
   * 
   * @param String of platlist id 
   */
  function showSongs(id) {
    $("#songs").html("");
    for (const song of u.playlists[id].songs) {
      var artists = "";
      for (const artist of song.track.artists) artists += `, ${artist.name}`;
      var html = `<div class="song song-hover" id="${song.track.id}"><img class="song-thumb" src="${song.track.album.images[0].url}"><span><h1 class="song-title">${song.track.name}</h1><h3 class="song-artists">${artists.substring(2)}</h3></span><button class="song-play-button"><i class="bi bi-play-fill"></i></button></div>`;
      $("#songs").append(html);
    };
  };

  async function showLoadingSongs() {
    $("#songs").html("");
    var string = `<div class="song-loading"><div class="song-loading-thumb"></div><div class="song-loading-title"></div><div class="song-loading-authors"></div></div>`;
    for (var i=0; i<20; i++) $("#songs").append(string);
  }

  // Refresh token;
  document.getElementById('obtain-new-token').addEventListener('click', function() {
    $.ajax({
      url: '/refresh_token',
      data: {
        'refresh_token': refresh_token
      }
    }).done(data => access_token = data.access_token);
  }, false);

  // Get, save and print all the playlists
  (async () => {
    var playlists = await getPlaylists();
    savePlaylists(playlists);
    showPlaylists();
  })();

  $("#playlists").on("click", ".playlist", async (e) => {
    var playlist_id = $(e.currentTarget).attr("id");
    $(e.currentTarget).addClass("to-remove");
    
    var playlists = $("#playlists").children();
    for (var i=0; i<playlists.length; i++) $(playlists[i]).removeClass("selected-playlist-to-remove");
    $(e.currentTarget).addClass("selected-playlist-to-remove");

    showLoadingSongs();

    if (u.playlists[playlist_id].songs.length === 0){
      var songs = await getSongsOfPlaylist(playlist_id);
      saveSongs(playlist_id, songs);
      showSongs(playlist_id);
    } else showSongs(playlist_id);
  });
  
  $("#move-songs-nav-button").on("click", (e) => {
    if (u.moving_mode) {
      u.moving_mode = false;
      u.selection.length = 0;
      $("#move-songs-button").html(`Mover 0 canciones`);
      $(".song").removeClass("grey-scale");
      $(".song").addClass("song-hover");
      $("#select-all-songs").css("visibility", "hidden");
      $("#move-songs-button").css("visibility", "hidden");
    } else {
      u.moving_mode = true;
      $(".song").addClass("grey-scale");
      $(".song").removeClass("song-hover");
      $("#select-all-songs").css("visibility", "visible");
      $("#move-songs-button").css("visibility", "visible");
    };
  });

  $("#songs").on("click", ".song", (e) => {
    if (u.moving_mode) {
      if (u.selection.includes(e.currentTarget)){
        var index = u.selection.indexOf(e.currentTarget);
        u.selection.splice(index, 1);
        $(e.currentTarget).addClass("grey-scale");
        $("#move-songs-button").html(`Mover ${u.selection.length} ${u.selection.length == 1 ? "canción" : "canciones"}`);
      } else {
        $(e.currentTarget).removeClass("grey-scale");
        u.selection.push(e.currentTarget);
        $("#move-songs-button").html(`Mover ${u.selection.length} ${u.selection.length == 1 ? "canción" : "canciones"}`);
      }
    }
  });

  $("#move-songs-button").on("click", (e) => {
    for (const playlist in u.playlists) {
      var html = `<div id="${playlist}" class="playlist to-move">${u.playlists[playlist].name}</div>`;
      $("#playlists-preview").append(html);
    };
    for (const item of u.selection) $("#songs-preview").append($(item).clone().removeClass("song").addClass("song-preview"));
    $("#move-songs-preview").css("visibility", "visible");
  });
  
  $("#select-all-songs").on("click", () => {
    var songs = $(".song");
    for (var i=0; i<songs.length; i++ ) u.selection.push(songs[i]);
    console.log(u.selection)
    $("#select-all-songs").html("Deshacer seleción");
    $(".song").removeClass("grey-scale");
    $("#move-songs-button").html(`Mover ${u.selection.length} ${u.selection.length == 1 ? "canción" : "canciones"}`);
  });

  $("#confirm-move").on("click", async (e) => {
    var playlist_id_to_move = $(".to-move.selected-playlist-to-move").attr("id");
    var playlist_id_to_remove = $(".playlist.selected-playlist-to-remove").attr("id");
    
    var uris_post = {};
    var uris_del = {};
    var counter = 0; 
    for (var i=0; i<u.selection.length; i++){
      if (i % 99 == 0) {
        counter++;
        uris_post[counter]='';
        uris_del[counter]=[];
      }
      var post_id = `spotify:track:${$(u.selection[i]).attr('id')},`;
      uris_post[counter] += post_id;
      
      var del_id = `spotify:track:${$(u.selection[i]).attr('id')}`;
      uris_del[counter].push({'uri': del_id});
    }

    
    // Insert songs in the new playlist
    for (var uri in uris_post) {
      var url_post = `https://api.spotify.com/v1/playlists/${playlist_id_to_move}/tracks?uris=${uris_post[uri].slice(0, -1)}`;
      HttpRequest(url_post, "POST");
    };

    // Remove the songs of the old list
    var del_data = {'tracks':[]};
    for (var i in uris_del) del_data['tracks'].push(uris_del[i]);
    var data = {'tracks': del_data['tracks'][0]};
    var url_delete = `https://api.spotify.com/v1/playlists/${playlist_id_to_remove}/tracks`;
    
    $.ajax({
      url: url_delete,
      type: "DELETE",
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(data),
      success: e => console.log(e)
    });

    $("#move-songs-preview").css("visibility","hidden");
    
    // Recargar las playlists
    u.playlists[playlist_id_to_move].songs.length = [];
    var songs = await getSongsOfPlaylist(playlist_id_to_move);
    saveSongs(playlist_id_to_move, songs);

    u.playlists[playlist_id_to_remove].songs.length = [];
    songs = await getSongsOfPlaylist(playlist_id_to_remove);
    saveSongs(playlist_id_to_remove, songs);
    showSongs(playlist_id_to_remove);
  });

  $("#playlists-preview").on("click", ".to-move", (e) => {
    var playlists = $("#playlists-preview").children();
    for (var i=0; i<playlists.length; i++) $(playlists[i]).removeClass("selected-playlist-to-move");
    $(e.currentTarget).addClass("selected-playlist-to-move");
  });
    
})();