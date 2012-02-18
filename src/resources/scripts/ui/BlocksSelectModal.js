(function($) {


if (typeof blx.ui == 'undefined')
	blx.ui = {};


/**
 * Blocks Select Modal
 */
blx.ui.BlocksSelectModal = blx.ui.Modal.extend({

	$addBtn: null,
	$cancelBtn: null,

	$items: null,
	$addItem: null,
	$fillerItems: null,
	$blockItems: null,
	$visibleBlockItems: null,

	selector: null,
	$selectedItems: null,

	field: null,

	init: function()
	{
		this.base('#blocksselect');

		this.selector = new blx.ui.Select(this.$body, {
			multi: true,
			waitForDblClick: true,
			handle: 'div.block',
			onSelectionChange: $.proxy(this, 'onSelectionChange')
		});

		this.$addBtn = this.$footBtns.filter('.add:first');
		this.$cancelBtn = this.$footBtns.filter('.cancel:first');

		this.addListener(this.$addBtn, 'click', 'addSelectedBlocks');
		this.addListener(this.$cancelBtn, 'click', 'hide');
		this.addListener(this.$body, 'keydown', 'onKeyDown');

		this.$items = this.$container.find('li');
		this.$addItem = this.$items.filter('.add:first');
		this.$fillerItems = this.$items.filter('.filler');
		this.$blockItems = $();
		this.$visibleBlockItems = $();
		this.$selectedItems = $();

		var $blockItems = this.$items.not(this.$addItem).not(this.$fillerItems);
		this.addBlocks($blockItems, false);
	},

	attachToField: function(field)
	{
		if (!this.visible)
			this.$container.show();

		if (this.$visibleBlockItems.length)
			this.$visibleBlockItems.first().removeClass('first');
		else
			this.$addItem.removeClass('first');

		// Show only the blocks that aren't already selected
		this.$blockItems.hide();
		this.$visibleBlockItems = $();
		var selectedBlockIds = [];
		this.selector.reset();
		this.onSelectionChange();

		for (var i = 0; i < field.$blockItems.length; i++)
		{
			var blockId = field.$blockItems[i].getAttribute('data-block-id');
			selectedBlockIds.push(blockId);
		}
		for (var i = 0; i < this.$blockItems.length; i++)
		{
			var blockId = this.$blockItems[i].getAttribute('data-block-id');
			if ($.inArray(blockId, selectedBlockIds) == -1)
			{
				$(this.$blockItems[i]).show();
				this.$visibleBlockItems = this.$visibleBlockItems.add(this.$blockItems[i]);
			}
		}

		if (this.$visibleBlockItems.length)
			this.$visibleBlockItems.first().addClass('first');
		else
			this.$addItem.addClass('first');

		this.selector.addItems(this.$visibleBlockItems);

		this.setFillers();

		// Hard-set the body's height
		this.$body.height('auto');
		this.$body.height(this.$body.height());

		if (!this.visible)
			this.$container.hide();

		this.field = field;
		this.positionRelativeTo(field.$container);
		this.show();
		this.$body.focus();
	},

	addBlocks: function(blockItems, addToSelector)
	{
		var $blockItems = $(blockItems);
		this.$blockItems = this.$blockItems.add($blockItems);
		this.addListener($blockItems, 'dblclick', 'onDblClick');

		if (addToSelector)
			this.selector.addItems($blockItems);
	},

	onDblClick: function()
	{
		clearTimeout(this.selector.clearMouseUpTimeout());
		this.onSelectionChange();
		this.addSelectedBlocks();
	},

	onSelectionChange: function()
	{
		this.$selectedItems = this.selector.getSelectedItems();

		if (this.$selectedItems.length)
			this.$addBtn.removeClass('disabled');
		else
			this.$addBtn.addClass('disabled');
	},

	addSelectedBlocks: function()
	{
		this.field.addBlocks(this.$selectedItems.clone().removeClass('first'));
		this.$selectedItems.removeClass('sel').hide();
		this.hide();
		this.field.$container.focus();
	},

	setFillers: function()
	{
		var totalFillers = this.$fillerItems.length,
			totalBlocks = this.$visibleBlockItems.length,
			neededFillers = 2 - totalBlocks;

		if (neededFillers > totalFillers)
		{
			var missingFillers = neededFillers - totalFillers;
			for (var i = 0; i < missingFillers; i++)
			{
				var $filler = $(document.createElement('li'));
				$filler.addClass('filler');
				$filler.insertAfter(this.$addItem);
				this.$fillerItems = this.$fillerItems.add($filler);
			}
		}
		else if (neededFillers < totalFillers)
		{
			var extraFillers = totalFillers - neededFillers;
			for (var i = 0; i < extraFillers; i++)
			{
				var $filler = this.$fillerItems.last();
				this.$fillerItems = this.$fillerItems.not($filler);
				$filler.remove();
			}
		}
	},

	onKeyDown: function(event)
	{
		// Ignore if meta key is down
		if (event.metaKey) return;

		// Ignore if the modal body doesn't have focus
		if (event.target != this.$body[0]) return;

		switch (event.keyCode)
		{
			case blx.SPACE_KEY:
			case blx.RETURN_KEY:
				event.preventDefault();
				if (this.$selectedItems.length)
					this.addSelectedBlocks();
				break;
			case blx.ESC_KEY:
				event.preventDefault();
				this.hide();
		}

	}

});


var _modal;

blx.getBlocksSelectModal = function()
{
	if (typeof _modal == 'undefined')
		_modal = new blx.ui.BlocksSelectModal();

	return _modal;
}


})(jQuery);
